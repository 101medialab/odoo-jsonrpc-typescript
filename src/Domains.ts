import { Upsert } from "./Upsert";
import { ToManyCommands } from "./ToManyCommands";
import { ObjectSimilarTo } from "./ConstructableByAttributeObject";

type TDomainConditionOperator =
    '=' | '!=' | '>' | '>=' | '<' | '<=' | '=?' |
    '=like' | 'like' | 'not like' | 'ilike' | 'not ilike' | '=ilike' |
    'in' | 'not in' | 'child_of' | 'parent_of'
;
type TDomainCondition = [string, TDomainConditionOperator, any];
export type TDomain = TDomainCondition | '|' | '&' | '!';
export type TReferenceValue<T> = T | number | Upsert<T>;
export type TToOne<T> = TReferenceValue<T> | Domains;
export type TToMany<T> = Array<TReferenceValue<T>> | Domains | ToManyCommands;

export class Domains {
    public domains: any[];

    constructor(...domains: TDomain[]) {
        this.domains = domains.filter(each => !!each);
    }

    static create<TModel>(conditionMap: ObjectSimilarTo<TModel>) {
        const conditions = [];

        for (let key in conditionMap) {
            let comparisonOperator = '=';
            let values = conditionMap[key];

            if (values instanceof Condition) {
                comparisonOperator = values.comparisonOperator;
                values = values.values;
            }

            conditions.push([key, comparisonOperator, values]);
        }

        return new Domains(...conditions);
    }
}

export class Condition {
    constructor(
        public comparisonOperator: TDomainConditionOperator,
        public values: any
    ) {
    }
}
