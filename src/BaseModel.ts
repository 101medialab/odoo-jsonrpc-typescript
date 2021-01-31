import { BaseModelFactory } from "./BaseModelFactory";
import { modelNameToFilePathMap } from "../OdooModels/modelNameToFilePathMap";
import { ConstructableByAttributeObject, ObjectSimilarTo } from "./ConstructableByAttributeObject";

export type TBaseModel<TModel> = {
    new(values?: ObjectSimilarTo<TModel>): BaseModel<TModel>,
    getModelByOdooModelName(string),
    modelName: string
};

export class BaseModel<TModel> extends ConstructableByAttributeObject<BaseModel<TModel>> {
    static modelName: string;

    static createModelFactory<TModel>() {
        return new BaseModelFactory<BaseModel<TModel>>(this);
    }

    static async getModelByOdooModelName(modelName: string) {
        const { filePath, className } = modelNameToFilePathMap[modelName];

        return (await import('../OdooModels/'+ filePath))[className];
    }

    id?: number;

    constructor(values: ObjectSimilarTo<TModel> = {}) {
        super(values);
    }
}
