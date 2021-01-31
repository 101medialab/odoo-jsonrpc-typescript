import { Domains } from "./Domains";
import { OdooClient } from "./OdooClient";
import { BaseModel } from "./BaseModel";

export class SearchByKeys {
    constructor(public keys: string[]) {
    }
}

export class UpsertOptions {
    skipUpdateIf?: ((client: OdooClient, current: BaseModel<any>) => boolean) | boolean;
    searchDomains: Domains | SearchByKeys;
}

export class Upsert<TModel extends BaseModel<TModel>> {
    public options: UpsertOptions;

    constructor(
        public data: TModel,
        options: UpsertOptions | Domains
    ) {
        if (!(options instanceof UpsertOptions)) {
            options = {
                searchDomains: options
            };
        }

        if (!('skipUpdateIf' in options)) {
            options.skipUpdateIf = false;
        }

        this.options = options;
    }
}
