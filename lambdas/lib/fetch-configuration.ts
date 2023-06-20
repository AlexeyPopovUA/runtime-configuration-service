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
        console.log({currentCfgName});
        if (visited.has(currentCfgName)) {
            currentCfgName = "";
        } else {
            const currentCfg = await fetchConfiguration(currentCfgName);

            if (currentCfg) {
                visited.add(currentCfgName);
                queue.push(currentCfg);

                currentCfgName = currentCfg?.extends ?? "";
            } else {
                currentCfgName = configuration.CLIENTS.FALLBACK_ENVIRONMENT;
            }
        }
    }

    console.log({visited});
    console.log({queue});

    return queue.reduceRight((cfg, acc) => ({...cfg, ...acc}), {});

    // const response = await ddbDocClient.get({
    //     TableName: process.env.CONFIG_TABLE,
    //     Key: {
    //         environment: name
    //     }
    // });
    //
    // const currentCfg = response?.Item || {};
    //
    // console.log({currentCfg});
    //
    // // go deeper
    // if (currentCfg?.extends) {
    //     const parentCfg = await fetchConfigurationByName(currentCfg.extends);
    //     return {...parentCfg, ...response.Item};
    //
    // // return the result as is
    // } else if (currentCfg) {
    //     return currentCfg;
    //
    // // fallback to the default environment
    // } else {
    //     const defaultCfg = await fetchConfigurationByName(configuration.CLIENTS.FALLBACK_ENVIRONMENT);
    //     return defaultCfg?.Item || {};
    // }
};

const fetchConfiguration = async (name: string) => {
    let currentCfg;

    try {
        const {Item} = await ddbDocClient.get({
            TableName: process.env.CONFIG_TABLE,
            Key: {
                environment: name
            }
        });

        currentCfg = Item;
    } catch (e) {
        console.error(e);
    }

    console.log("fetchConfiguration");
    console.log(JSON.stringify({currentCfg}, null, 4));
    return currentCfg;
};

export default fetchConfigurationByName;
