export type ObjectSimilarTo<T> = { [key in keyof T]?: T[key] } | { [key: string]: any };

export class ConstructableByAttributeObject<T> {
    constructor(values: ObjectSimilarTo<T> = {}) {
        for (const key of Object.keys(values)) {
            this[key] = values[key];
        }
    }
}
