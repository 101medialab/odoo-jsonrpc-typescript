import { IOdooClientSettings } from "./IOdooClientSettings";
import { OdooClient } from "./OdooClient";

let client: OdooClient = null;

export class SingletonClient {
    constructor() {
        throw new Error('Call SingletonClient.createOdooClient and SingletonClient.getOdooClient directly');
    }

    static async createOdooClient(options: IOdooClientSettings, force: boolean = false) {
        if (!client || force) {
            client = new OdooClient(options);
        }

        return client;
    }

    static async connect(options: IOdooClientSettings) {
        if (!client) {
            SingletonClient.createOdooClient(options);
        }

        if (options.username && options.password) {
            await new Promise((resolve, reject) => {
                client.connect(options, (error, result) => {
                    if (result) {
                        resolve(result);
                    } else {
                        reject(error);
                    }
                });
            });
        }

        return SingletonClient.getOdooClient();
    }

    static getOdooClient() {
        if (client) {
            return client;
        }

        throw new Error('You need to initialize an Odoo Client first by calling SingletonClient.createOdooClient()');
    }
}
