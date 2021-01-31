import { Client, HTTPTransport, JSONRPCError, RequestManager } from "@open-rpc/client-js";
import { IOdooClientSettings } from "./IOdooClientSettings";
import { Domains } from "./Domains";
import { IReadCreatedObjectsOption } from "./BaseModelFactory";
import { BaseModel } from "./BaseModel";
import { ModelToRPCPayloadConverter } from "./ModelToRPCPayloadConverter";
import { ModelReferenceSymbol, ReferenceQuantityMode } from "./ModelReference";
import { ResUsers } from "../OdooModels/res/users";
import { ExtendedConsole } from "../../log-with-location";

export type TPreloadRelationshipOption = {
    [key: string]: TPreloadRelationshipOption
}

// Forked from https://github.com/dennybiasiolli/odoo-xmlrpc/tree/babelize-all and refactored code then converted to TS
export class OdooClient {
    protected client: Client;
    protected uid: number;
    protected dbName: string;
    protected password: string;
    protected modelToRPCPayloadConverter: ModelToRPCPayloadConverter;

    constructor(config: IOdooClientSettings) {
        this.client = new Client(
            new RequestManager([
                new HTTPTransport(config.url + '/jsonrpc')
            ])
        );

        this.dbName = config.dbName;
        this.uid = 0;

        this.modelToRPCPayloadConverter = new ModelToRPCPayloadConverter(this);
    }

    protected async createRPCMethodPromise(service, method, args = {}) {
        return new Promise((resolve, reject) => {
            this.client.request({
                method: "call",
                params: {
                    service,
                    method,
                    args
                }
            })
                .then(resolve, (err: Error) => {
                    let isJSONParsable = false;

                    try {
                        if (err instanceof JSONRPCError) {
                            JSON.parse((err.data as any).data);
                            isJSONParsable = true;
                        }
                    } catch (e) {
                    }

                    if (err) {
                        ExtendedConsole.logWithLocation({
                            err,
                            payload: {
                                service,
                                method,
                                args
                            }
                        });

                        if (isJSONParsable === false) {
                            return reject(err);
                        }
                    }

                    resolve(null);
                });
        });
    }

    connect(loginCredential: IOdooClientSettings, callback) {
        this.password = loginCredential.password;

        this.createRPCMethodPromise('common', 'login', [this.dbName, loginCredential.username, this.password])
            .then((value: number) => {
                if (!value) {
                    return callback({ message: "No UID returned from authentication." }, null)
                }

                this.uid = value;

                callback(null, value)
            }, error => {
                if (error) {
                    callback(error, null)
                }
            });
    }

    protected generateParams(modelName: string, method: string, args: any[] = [], kwargs: object = {}): any {
        return [this.dbName, this.uid, this.password, modelName, method, args, kwargs];
    }

    async execute_kw(modelName: string, method: string, args: any[] = [], kwargs: object = {}, callback) {
        return this.runRPCMethodPromise(
            'object', 'execute_kw',
            this.generateParams(modelName, method, args, kwargs),
            callback
        );
    }

    async must_execute_kw(modelName: string, method: string, args: any[] = [], kwargs: object = {}) {
        return await new Promise<any[]>(async (resolve, reject) => {
            await this.execute_kw(
                modelName, method, args, kwargs,
                (rejected, resolved) => {
                    if (rejected) {
                        reject(rejected);
                    } else {
                        resolve(resolved);
                    }
                }
            ).catch((e) => {
                ExtendedConsole.logWithLocation({ modelName, method, args, kwargs });

                throw e;
            });
        });
    }

    async exec_workflow(modelName, method, params, callback) {
        return this.runRPCMethodPromise(
            'object',
            'exec_workflow',
            this.generateParams(modelName, method, params),
            callback
        );
    }

    async render_report(report, params, callback) {
        return this.runRPCMethodPromise(
            'report',
            'render_report',
            // FIXME: Not sure how to fix it
            this.generateParams(report, '', params),
            callback
        );
    }

    async runRPCMethodPromise(service: string, action: string, params: any[], callback) {
        try {
            const value = await this.createRPCMethodPromise(service, action, params);

            return callback(null, value);
        } catch (error) {
            return callback(error, null);
        }
    }

    public async switchUserToAnotherCompany(companyName: string) {
        await this.update(
            ResUsers.modelName,
            this.uid,
            new ResUsers({
                company_id: new Domains(['name', '=', companyName])
            })
        );
    }

    async createIfNotFound<TModel extends BaseModel<TModel>>(
        modelName: string,
        domain: Domains,
        valuesToUpsert: TModel,
        readCreatedObjects: IReadCreatedObjectsOption = null
    ): Promise<number[] | TModel[]> {
        const ids = await this.search(modelName, domain);

        if (ids.length === 0) {
            return await this.create(modelName, [valuesToUpsert], readCreatedObjects);
        } else {
            return ids;
        }
    }

    async upsert<TModel extends BaseModel<TModel>>(
        modelName: string,
        domain: Domains,
        valuesToUpsert: TModel,
        readCreatedObjects: IReadCreatedObjectsOption = null,
        ensureOne = true
    ): Promise<number[] | TModel[]> {
        const ids = await this.search(modelName, domain);

        let result = null;

        if (ids.length === 0) {
            result = await this.create(modelName, [valuesToUpsert], readCreatedObjects);
        } else {
            result = await this.update(modelName, ids, valuesToUpsert);
        }

        if (result && ensureOne) {
            result = result[0];
        }

        return result;
    }

    async create<TModel extends BaseModel<TModel>>(
        modelName: string,
        targets: TModel[],
        readCreatedObjects: IReadCreatedObjectsOption = null
    ): Promise<number[] | TModel[]> {
        const objectIds = await this.must_execute_kw(
            modelName, 'create',
            [await Promise.all(targets.map(async ____ => await this.modelToRPCPayloadConverter.convert(____)))]
        );

        if (readCreatedObjects) {
            if (!('limit' in readCreatedObjects)) {
                readCreatedObjects.limit = objectIds.length;
            }

            return await this.search_read(modelName, new Domains(['id', 'in', objectIds]), readCreatedObjects);
        } else {
            return objectIds;
        }
    }

    async update<TModel extends BaseModel<TModel>>(
        modelName: string,
        targets: TModel[] | Domains | number[] | number,
        valuesToUpdate: TModel
    ): Promise<number[]> {
        let ids: number[];

        if (targets instanceof Domains) {
            ids = await this.search(modelName, targets);
        } else if (typeof targets === 'number') {
            ids = [targets as number];
        } else if (typeof targets[0] === 'number') {
            ids = targets as number[];
        } else {
            ids = this.getModelIds(targets as TModel[]);
        }

        const payload = [ids, await this.modelToRPCPayloadConverter.convert(valuesToUpdate)];

        const result = await this.must_execute_kw(modelName, 'write', payload);

        if (result) {
            return ids;
        }

        ExtendedConsole.logWithLocation({ result, ids });
        throw new Error('Odoo Update XMLRPC call failed for ' + modelName);
    }

    // TODO: Have not tested
    async delete(modelName: string, targets: BaseModel<any>[]) {
        return await this.must_execute_kw(modelName, 'unlink', this.getModelIds(targets));
    }

    async search(modelName: string, domains: Domains): Promise<number[]> {
        return await this.must_execute_kw(modelName, 'search', [domains.domains]);
    }

    async search_read(
        modelName: string,
        domains: Domains | number | number[],
        readCreatedObjects: IReadCreatedObjectsOption = null,
        preloadRelationships: TPreloadRelationshipOption = null
    ) {
        if (typeof domains === 'number') {
            domains = new Domains(['id', '=', domains]);
        } else if (domains instanceof Array && typeof domains[0] === 'number') {
            domains = new Domains(['id', 'in', domains]);
        }

        const result = await this.must_execute_kw(modelName, 'search_read', [(domains as Domains).domains], readCreatedObjects);

        if (preloadRelationships && Object.keys(preloadRelationships).length > 0) {
            for (let i = 0; i < result.length; i++) {
                result[i] = await this.preloadRelationships(modelName, result[i], preloadRelationships);
            }
        }

        return result;
    }

    async preloadRelationships<TModel extends BaseModel<TModel>>(modelName: string, data: TModel, preloadRelationships: TPreloadRelationshipOption) {
        if (Object.keys(preloadRelationships).length === 0) {
            return data;
        }

        const modelClass = await BaseModel.getModelByOdooModelName(modelName);

        for (const attributeName of Object.keys(preloadRelationships)) {
            let childAttributesToPreload = null;

            if (typeof preloadRelationships[attributeName] === 'object') {
                childAttributesToPreload = preloadRelationships[attributeName];
            }

            const preloadingAttributeModelReference = Reflect.getMetadata(ModelReferenceSymbol, new modelClass(), attributeName);

            let preloadingAttributeDatabaseIds = [];
            if (preloadingAttributeModelReference.quantityMode === ReferenceQuantityMode.MULTI) {
                preloadingAttributeDatabaseIds = data[attributeName];

                if (
                    preloadingAttributeDatabaseIds.length > 0 &&
                    typeof preloadingAttributeDatabaseIds[0] === 'object' &&
                    'id' in preloadingAttributeDatabaseIds[0]
                ) {
                    preloadingAttributeDatabaseIds = preloadingAttributeDatabaseIds.map(each => each.id);
                }
            } else {
                preloadingAttributeDatabaseIds = [data[attributeName][0]];
            }

            if (!preloadingAttributeDatabaseIds.length) {
                continue;
            }

            const preloadingAttributeModelClass = await BaseModel.getModelByOdooModelName(preloadingAttributeModelReference.modelName)

            let preloadedResult = await this.search_read(
                preloadingAttributeModelClass.modelName,
                preloadingAttributeDatabaseIds, null,
                childAttributesToPreload ? childAttributesToPreload : {}
            );

            if (preloadingAttributeModelReference.quantityMode === ReferenceQuantityMode.SINGLE) {
                preloadedResult = preloadedResult[0];
            }

            data[attributeName] = preloadedResult;
        }

        return data;
    }

    protected getModelIds<TModel extends BaseModel<TModel>>(targets: TModel[]): number[] {
        return targets.map(____ => ____.id);
    }
}
