import { BaseModel, TBaseModel } from "./BaseModel";
import { OdooClient, TPreloadRelationshipOption } from "./OdooClient";
import { SingletonClient } from "./SingletonClient";
import { Domains } from "./Domains";

export interface IReadCreatedObjectsOption {
    fields?: string[];
    limit?: number;
}

export class BaseModelFactory<TModel extends BaseModel<TModel>> {
    protected odooClient: OdooClient;

    constructor(protected modelClass: TBaseModel<TModel>) {
        this.odooClient = SingletonClient.getOdooClient();
    }

    async switchUserToAnotherCompany(companyName: string) {
        return this.odooClient.switchUserToAnotherCompany(companyName);
    }

    async createIfNotFound(
        domain: Domains,
        valuesToUpsert: TModel,
        readCreatedObjects: IReadCreatedObjectsOption = null
    ): Promise<number[] | TModel[]> {
        return this.odooClient.createIfNotFound(this.modelClass.modelName, domain, valuesToUpsert, readCreatedObjects);
    }

    async upsert(
        domain: Domains,
        valuesToUpsert: TModel,
        readCreatedObjects: IReadCreatedObjectsOption = null
    ): Promise<number | TModel | number[] | TModel[]> {
        return this.odooClient.upsert(this.modelClass.modelName, domain, valuesToUpsert, readCreatedObjects);
    }

    async create(targets: TModel[], readCreatedObjects: IReadCreatedObjectsOption = null): Promise<number[] | TModel[]> {
        return this.odooClient.create(this.modelClass.modelName, targets, readCreatedObjects);
    }

    async update(targets: TModel[] | Domains | number[] | number, valuesToUpdate: TModel) {
        return this.odooClient.update(this.modelClass.modelName, targets, valuesToUpdate);
    }

    async delete(targets: TModel[]) {
        return this.odooClient.delete(this.modelClass.modelName, targets);
    }

    async search(domains: Domains) {
        return this.odooClient.search(this.modelClass.modelName, domains);
    }

    protected getModelIds(targets: TModel[]): number[] {
        return targets.map(____ => ____.id);
    }

    async search_read(
        domains: Domains | number | number[],
        readCreatedObjects: IReadCreatedObjectsOption = null,
        preloadRelationships: TPreloadRelationshipOption = null
    ) {
        return this.odooClient.search_read(this.modelClass.modelName, domains, readCreatedObjects, preloadRelationships);
    }

    execute_kw(method: string, params: any): Promise<any> {
        return this.odooClient.must_execute_kw(this.modelClass.modelName, method, params);
    }
}
