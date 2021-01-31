import { Domains } from "./Domains";
import { BaseModel } from "./BaseModel";

export type FindOdooReference = number | Domains;

// https://github.com/odoo/odoo/blob/14.0/odoo/models.py#L3540-L3561
export class ToManyCommands {
    commands = []

    // (0, 0, values)
    // adds a new record created from the provided value dict.
    createAndAddValuesAsReference(values: any[]) {
        values.forEach(value => this.commands.push([0, 0, value]));

        return this;
    }

    // (1, id, values)
    // updates an existing record of id id with the values in values. Can not be used in create().
    updateSpecificReferenceId(findOdooReference: FindOdooReference, values: any) {
        this.commands.push([1, findOdooReference, values]);

        return this;
    }

    // (2, id, 0)
    // removes the record of id id from the set, then deletes it (from the database). Can not be used in create().
    removeSpecificReference(findOdooReference: FindOdooReference) {
        this.commands.push([2, findOdooReference, 0]);

        return this;
    }

    // (3, id, 0)
    // removes the record of id id from the set, but does not delete it. Can not be used in create().
    removeSpecificReferenceId(findOdooReference: FindOdooReference) {
        this.commands.push([3, findOdooReference, 0]);

        return this;
    }

    removeSpecificReferenceIds(findOdooReferences: FindOdooReference[]) {
        findOdooReferences.forEach(each => this.removeSpecificReferenceId(each));

        return this;
    }

    // (4, id, 0)
    // adds an existing record of id id to the set.
    addSpecificReferenceId(findOdooReference: FindOdooReference) {
        this.commands.push([4, findOdooReference, 0]);

        return this;
    }

    addSpecificReferenceIds(findOdooReferences: FindOdooReference[]) {
        findOdooReferences.forEach(each => this.addSpecificReferenceId(each));

        return this;
    }

    // (5, 0, 0)
    // removes all records from the set, equivalent to using the command 3 on every record explicitly. Can not be used in create().
    removeAll() {
        this.commands.push([5, 0, 0]);

        return this;
    }

    // (6, 0, ids)
    // replaces all existing records in the set by the ids list, equivalent to using the command 5 followed by a command 4 for each id in ids.
    replaceAll(references: (number | BaseModel<any>)[] | Domains) {
        this.commands.push([6, 0, references]);

        return this;
    }
}
