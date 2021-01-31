# odoo-jsonrpc-typescript
Works for both browser and node.js application

---
## Create connection
```ts
await SingletonClient.createOdooClient({
    url: 'http://localhost:8069',
    dbName: 'odoo_dev',
    username: 'admin',
    password: 'admin'
});
```

## Create record
```ts
const purchaseOrderFactory = new BaseModelFactory(PurchaseOrder);
const purchaseOrderId = await purchaseOrderFactory.create([
    new PurchaseOrder({
        // Shorthand for searching with domains, map will be converted as [key, '=', value]
        company_id: Domains.create({ name: 'Your company' }),
        // Traditional domains that works the same way as Odoo does
        partner_id: new Domains(['name', '=', 'Stussy']),
        picking_type_id: new Domains(
            // Dot syntax works the same way as Odoo does 
            ['warehouse_id.name', '=', 'A specific warehouse'],
            ['name', '=', 'Receipts']
        ),
        // Search with specific domain, create if not found
        hbx_season_id: new Upsert(
            new HbxSeason({
                name: 'SS20',
                code: '1C'
            }),
            new Domains(['name', '=', 'SS20']),
        ),
        // Create multiple items under One2many field 
        order_line: [
            new PurchaseOrderLine({
                name: 'Stussy Black T-shirt',
                date_planned: '2020-01-01',
                // Domain works in here too
                product_id: Domains.create({ default_code: 'SKU-1' }),
                product_qty: 100,
                product_uom: 1,
                price_unit: 20,
            }),
            new PurchaseOrderLine({
                name: 'Stussy White T-shirt',
                date_planned: '2020-01-01',
                product_id: Domains.create({ default_code: 'SKU-2' }),
                product_qty: 100,
                product_uom: 1,
                price_unit: 20,
            }),
        ],
    })
]) as number[];
```

## 0? 1? 2? 3? 4? 5? 6?
For creating or updating `_ToMany` fields, you can use `ToManyCommand`
```ts
new PurchaseOrder({
    order_line: new ToManyCommand()
        // Mode 0: add a new line
        .createAndAddValuesAsReference(
            new PurchaseOrderLine({ })
        )
        
        // Mode 1: update value in specific target
        // In here find the purchase order line ordering SKU-2 and update order quantity to 12 
        .updateSpecificReferenceId(
            Domains.create({
                'product_id.default_code': 'SKU-2' 
            }),
            new PurchaseOrderLine({
                product_qty: 12,
            })
        )
        
        // Mode 2: remove from _ToMany relationship and delete it from DB too
        // In here, remove ordering SKU-3 and delete this purchase.order.line from DB afterwards
        .removeSpecificReference(
            Domains.create({
                'product_id.default_code': 'SKU-3'
            })
        )
        
        // Mode 3: remove from NToMany relationship only and keep the record in DB
        // Please noted that the domain here should return one single id, if an array of ids returned it will not work
        .removeSpecificReferenceId(
            Domains.create({
                'product_id.default_code': 'SKU-3'
            })
        )
        // Still mode 3 but accepting an array of input and calling `removeSpecificReferenceId` with loop
        .removeSpecificReferenceIds([
            Domains.create({
                'product_id.default_code': 'SKU-4'
            }),
            Domains.create({
                'product_id.default_code': 'SKU-5'
            })
        ])
        
        // Mode 4: add to _ToMany relationship
        // Please noted that the domain here should return one single id, if an array of ids returned it will not work
        .addSpecificReferenceId(
            Domains.create({
                'product_id.default_code': 'SKU-6'
            })
        )
        // Still mode 4 but accepting an array of input and calling `addSpecificReferenceId` with loop
        .addSpecificReferenceIds([
            Domains.create({
                'product_id.default_code': 'SKU-7'
            }),
            Domains.create({
                'product_id.default_code': 'SKU-8'
            })
        ])
        
        // Mode 5: clear all relationships
        .removeAll()
        
        // Mode 6: Clear all relationships and replace input as those in relationship 
        .replaceAll()
})
```


## Calling method in model
```ts
await yourModel.execute_kw(methodName, args = [], kwargs = {});

await purchaseOrderFactory.execute_kw('button_confirm', [purchaseOrderId]);
```

## Preload relationship
`search_read` in RPC only return the first layer of data, in this RPC we support data preloading in relationships
Consider we want to read source and destination location and product information of each purchase order line for the purchase order just created:
```ts
const poCreated = await purchaseOrderFactory.search_read(purchaseOrderId, null, {
    // Load data in order_line 
    order_line: {
        // And load data move_ids in order_line
        move_ids: {
            // Of couse in case our program need to know the detail of location_id and location_dest_id, just specify it 
            location_id: {},
            location_dest_id: {}
        },
        product_id: {
        }
    }
});

console.log(poCreated);
```

## Flexible CRUD methods design
`BaseModelFactory` supports `create`, `createIfNotFound`, `upsert`, `update`, `delete`, `search`, `search_read` and `execute_kw`
The same method can take different form of input and all works. Take search_read as example:
```ts
// Same result, search PO with id '1'
po = await purchaseOrderFactory.search_read(1);
po = await purchaseOrderFactory.search_read([1]);
po = await purchaseOrderFactory.search_read(Domains.create({ id: 1 }));

// Same result, search PO with id in '1', '2' 
po = await purchaseOrderFactory.search_read([1, 2]);
po = await purchaseOrderFactory.search_read(new Domains(['id', 'in', [1, 2]]));
```

## Read after create or update
Our RPC client supports record reading after create or update, it runs `search_read` and you can specify fields and limit.
```ts
const productTemplate: ProductTemplate = (
    await productTemplateFactory.create([
        new ProductTemplate({
            name: 'Stussy Black T-shirt',
            type: 'product',
            categ_id: new Domains(['name', '=', InventoryType.BOUGHT]),
            default_code: 'STU-TS-000001-BK' + testId
        })
    ], {
        // Read back product_variant_ids once this product has been created
        fields: ['product_variant_ids']
    })
)[0] as ProductTemplate;
```
