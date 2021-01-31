export const ModelReferenceSymbol = Symbol('ModelReferenceSymbol')

export const ReferenceQuantityMode = {
    MULTI: 'MULTI',
    SINGLE: 'SINGLE'
};

export type ReferenceQuantityMode = typeof ReferenceQuantityMode[keyof typeof ReferenceQuantityMode];

export interface IModelReference {
    modelName: string;
    quantityMode: ReferenceQuantityMode;
}

export function ModelReference(modelName: string, quantityMode: ReferenceQuantityMode = ReferenceQuantityMode.SINGLE) {
    return Reflect.metadata(ModelReferenceSymbol, {
        modelName: modelName,
        quantityMode
    });
}
