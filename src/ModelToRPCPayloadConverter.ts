import { BaseModel } from "./BaseModel";
import { IModelReference, ModelReferenceSymbol, ReferenceQuantityMode } from "./ModelReference";
import { Domains } from "./Domains";
import { OdooClient } from "./OdooClient";
import { SearchByKeys, Upsert } from "./Upsert";
import { ToManyCommands } from "./ToManyCommands";

export class ModelToRPCPayloadConverter {
    constructor(protected odooClient: OdooClient) {
    }

    async convert(input): Promise<any> {
        const result = {};

        for (const key of Object.keys(input)) {
            if (typeof input[key] === 'object' && input[key] !== null) {
                if (input[key] instanceof Array) {
                    result[key] = await this.convertForArray(input[key]);
                } else {
                    const modelReference: IModelReference = Reflect.getMetadata(ModelReferenceSymbol, input, key);

                    if (input[key] instanceof ToManyCommands) {
                        result[key] = await this.convertForOdooToManyOperations(modelReference, input[key]);
                    } else {
                        result[key] = await this.convertForObject(modelReference, input[key]);
                    }
                }
            } else {
                result[key] = input[key];
            }
        }

        return result;
    }

    async convertForArray(toManyFieldData: any[]) {
        if (typeof toManyFieldData[0] === 'number') {
            return toManyFieldData;
        }

        return (await Promise.all(
            toManyFieldData.map(async ____ => await this.convert(____))
        )).map(____ => [0, 0, ____]);
    }

    async convertForOdooToManyOperations(modelReference: IModelReference, current: any) {
        const toManyCommands: ToManyCommands = current;

        return await Promise.all(
            toManyCommands.commands.map(async (command) => {
                if (command[1] !== 0 && typeof command[1] !== 'number') {
                    command[1] = await this.searchWithDomain(modelReference, command[1]);
                }

                // Mode 1-4 accept id only, see ToManyCommands
                if ([1, 2, 3, 4].indexOf(command[0]) > -1 && command[1] instanceof Array) {
                    command[1] = command[1][0];
                }

                if (command[0] === 6) {
                    if (command[2] instanceof Array) {
                        if (command[2].length > 0 && typeof command[2][0] !== 'number') {
                            command[2] = await Promise.all(
                                command[2].map(async (data: BaseModel<any>) => {
                                    return await this.convertForObject(modelReference, data);
                                })
                            )
                        }
                    } else {
                        command[2] = await this.convertForObject(modelReference, command[2]);
                    }
                }

                if (command[2] instanceof Domains) {
                    command[2] = await this.searchWithDomain(modelReference, command[2]);
                }

                return command;
            })
        );
    }

    async convertForObject(modelReference: IModelReference, current: any) {
        if (current instanceof BaseModel) {
            return await this.convertForBaseModel(modelReference, current);
        } else {
            if (current instanceof Domains) {
                return await this.searchWithDomain(modelReference, current);
            } else if (current instanceof Upsert) {
                return await this.handleUpsert<typeof current>(modelReference, current);
            }
        }
    }

    async convertForBaseModel(modelReference: IModelReference, current: any) {
        if (current.id) {
            return current.id;
        } else {
            return await this.odooClient.must_execute_kw(modelReference.modelName, 'create', [await this.convert(current)]);
        }
    }

    async searchWithDomain(modelReference: IModelReference, domains: Domains) {
        if (!modelReference) {
            console.trace('modelReference is undefined or null');
        }

        const results = await this.odooClient.must_execute_kw(modelReference.modelName, 'search', [domains.domains]);

        if (modelReference.quantityMode === ReferenceQuantityMode.SINGLE) {
            if (results.length !== 1) {
                // TODO: This should be error
                throw new Error(
                    'No. of search results returned is not exactly one. Length: ' + results.length +
                    '. Domains: ' + JSON.stringify([(domains as Domains).domains] + '. Result: ' + JSON.stringify(results))
                );
            }

            return results[0];
        }

        return results;
    }

    async handleUpsert<TModel>(modelReference: IModelReference, { data, options }: Upsert<TModel>) {
        if (!modelReference) {
            console.trace('modelReference is undefined or null');
        }

        let searchDomains: Domains;

        if (options.searchDomains instanceof Domains) {
            searchDomains = options.searchDomains as Domains;
        } else if (options.searchDomains instanceof SearchByKeys) {
            const conditionMap = {};

            options.searchDomains.keys.forEach(key => {
                conditionMap[key] = data[key];
            });

            searchDomains = Domains.create(conditionMap);
        }

        let result = null;
        let existingRecord;

        try {
            existingRecord = await this.searchWithDomain(modelReference, searchDomains);
        } catch (e) {
            existingRecord = null;
        }

        if (existingRecord) {
            if (options.skipUpdateIf) {
                let skipUpdateIf: boolean;

                if (typeof options.skipUpdateIf === 'boolean') {
                    skipUpdateIf = options.skipUpdateIf;
                } else {
                    skipUpdateIf = options.skipUpdateIf(this.odooClient, data);
                }

                if (skipUpdateIf) {
                    // Found existing record but decided not to update
                    return false;
                }
            }

            await this.odooClient.must_execute_kw(modelReference.modelName, 'write', [[existingRecord], await this.convert(data)]);

            result = [existingRecord];
        } else {
            result = await this.odooClient.must_execute_kw(modelReference.modelName, 'create', [[await this.convert(data)]]);
        }

        return result.length === 1 && result[0] ? result[0] : null;
    }
}
