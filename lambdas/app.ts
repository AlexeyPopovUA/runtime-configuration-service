import express, {Request, Response} from "express";
import cors from "cors";
import { URL } from "node:url";

import fetchConfigurationByName from "./lib/fetch-configuration";
import {getCorsCfg} from "./lib/configureCors";
import {isEnvironmentAllowed, isOriginAllowed} from "./lib/environment";

const app = express();

// shared CORS configuration for all routes
app.use(cors(getCorsCfg()));

const router = express.Router();
router.use(express.json());
router.use(express.urlencoded({extended: true}));

/**
 * This route is for web applications where "origin" and/or "referer" request headers are automatically sent by browsers
 */
router.get("/edge", async (req: Request<unknown, unknown, unknown, unknown>, res: Response) => {
    const origin = req.header("origin");

    if (origin && isOriginAllowed(origin)) {
        const environment = new URL(origin).hostname;

        const configuration = await fetchConfigurationByName(environment)

        res.json({configuration});
    } else {
        // add failure details here when necessary
        res.sendStatus(403);
    }

    return res;
});

/**
 * This route is for nodejs or mobile applications where environment name is sent via "environment" query parameter
 */
router.get("/by-key", async (req: Request<unknown, unknown, unknown, {
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
});

app.use("/", router);

export {app};
