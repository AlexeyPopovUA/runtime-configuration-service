import {CorsOptions} from "cors";

import {isOriginAllowed} from "./environment";
import cfg from "../../cfg/configuration";

/**
 * Shared CORS configuration for all routes
 */
export const getCorsCfg = (): CorsOptions => ({
    /**
     * If origin header is not "allowed", it will be replaced by the fallback origin in the OPTIONS response.
     * So request fails with CORS error in a browser
     */
    origin: (origin, callback) => {
        callback(null, (origin && isOriginAllowed(origin)) ? origin: cfg.CLIENTS.FALLBACK_ORIGIN);
    },
    // these headers will be accessible in the browser
    exposedHeaders: [
        "Content-Encoding", "Content-Type", "Cloudfront-Viewer-Country", "Cloudfront-Viewer-City"
    ],
    // allowed methods
    methods: ["OPTIONS", "GET"]
});
