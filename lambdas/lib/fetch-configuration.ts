import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {DynamoDBDocument} from "@aws-sdk/lib-dynamodb";

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

    if (response?.Item?.extends) {
        const parentCfg = await fetchConfigurationByName(response.Item.extends);

        return {...parentCfg, ...response.Item };
    } else {
        return response?.Item ?? {};
    }
}

export default fetchConfigurationByName;
