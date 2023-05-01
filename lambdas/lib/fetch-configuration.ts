import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {DynamoDBDocument} from "@aws-sdk/lib-dynamodb";

import configuration from "../../cfg/configuration";

const client = new DynamoDBClient({region: process.env.REGION});
const ddbDocClient = DynamoDBDocument.from(client);

/**
 * Fetches configuration by environment name. If configuration "extends" another one - it will be fetched as a base one.
 * There is no limit of inheritance nesting level. Just make sure that there is no cyclic reference.
 * @param name - environment name
 */
const fetchConfigurationByName = async (name: string): Promise<Record<string, any>> => {
    const visited = new Set<string>();
    const queue = [];
    let currentCfgName = name;

    while (currentCfgName) {
        if (visited.has(currentCfgName)) {
            currentCfgName = "";
        } else {
            const currentCfg = await getCfgFromDB(currentCfgName);

            if (currentCfg) {
                visited.add(currentCfgName);
                queue.push(currentCfg);

                currentCfgName = currentCfg?.extends ?? "";
            } else {
                currentCfgName = configuration.CLIENTS.FALLBACK_ENVIRONMENT;
            }
        }
    }

    return queue.reduceRight((cfg, acc) => ({...cfg, ...acc}), {});
};

const getCfgFromDB = async (environment: string) => {
    let currentCfg;

    try {
        const {Item} = await ddbDocClient.get({
            TableName: process.env.CONFIG_TABLE,
            Key: {
                environment
            }
        });

        currentCfg = Item;
    } catch (e) {
        console.error(e);
    }

    return currentCfg;
};

export default fetchConfigurationByName;
