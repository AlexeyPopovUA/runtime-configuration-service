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
    const response = await ddbDocClient.get({
        TableName: process.env.CONFIG_TABLE,
        Key: {
            environment: name
        }
    });

    console.log({found: response?.Item ?? "[nothing!]"});

    // go deeper
    if (response?.Item?.extends) {
        const parentCfg = await fetchConfigurationByName(response.Item.extends);
        return {...parentCfg, ...response.Item };

    // return the result as is
    } else if (response?.Item) {
        return response?.Item;

    // fallback to the default environment
    } else {
        const defaultCfg = await fetchConfigurationByName(configuration.CLIENTS.FALLBACK_ENVIRONMENT);
        return defaultCfg.Item;
    }
}

export default fetchConfigurationByName;
