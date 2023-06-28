import {name} from "../package.json";

export default {
    COMMON: {
        project: name,
        region: process.env?.AWS_DEPLOYMENT_REGION || "",
        account: process.env?.AWS_ACCOUNT || ""
    },
    HOSTING: {
        hostedZoneID: process.env?.HOSTED_ZONE_ID || "",
        hostedZoneName: "oleksiipopov.com",
        domainName: "configuration-service.examples.oleksiipopov.com"
    },
    CLIENTS: {
        ALLOWED_ORIGINS: [
            "https://prod.config-demo.examples.oleksiipopov.com",
            "https://acc.config-demo.examples.oleksiipopov.com"
        ],
        ALLOWED_ORIGIN_ENDS: [
            "dev.config-demo.examples.oleksiipopov.com",
            "127.0.0.1:9000",
            "localhost:9000"
        ],
        ALLOWED_ENVIRONMENTS: [
            "production-by-key",
            "default"
        ],
        FALLBACK_ORIGIN: "https://prod.config-demo.examples.oleksiipopov.com",
        FALLBACK_ENVIRONMENT: "default"
    }
};
