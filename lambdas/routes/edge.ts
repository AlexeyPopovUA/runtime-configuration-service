import {URL} from "node:url";
import {Request, Response} from "express";

import fetchConfigurationByName from "../lib/fetch-configuration";
import {isOriginAllowed} from "../lib/environment";

export const edgeRouteHandler = async (req: Request<unknown, unknown, unknown, unknown>, res: Response) => {
    const origin = req.header("origin");

    if (origin && isOriginAllowed(origin)) {
        const environment = new URL(origin).hostname;

        const configuration = await fetchConfigurationByName(environment);
        console.log("edgeRouteHandler", configuration);

        res.json({configuration});
    } else {
        // add failure details here when necessary
        res.sendStatus(403);
    }

    return res;
};
