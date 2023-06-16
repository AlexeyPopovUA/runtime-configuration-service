import {Request, Response} from "express";

import {isEnvironmentAllowed} from "../lib/environment";
import fetchConfigurationByName from "../lib/fetch-configuration";

export const byKeyRouteHandler = async (req: Request<unknown, unknown, unknown, {
    environment: string;
}>, res: Response) => {
    const environment = req.query?.environment;

    if (environment && isEnvironmentAllowed(environment)) {
        const configuration = await fetchConfigurationByName(environment);

        res.json({configuration});
    } else {
        // add failure details here when necessary
        res.sendStatus(403);
    }

    return res;
};
