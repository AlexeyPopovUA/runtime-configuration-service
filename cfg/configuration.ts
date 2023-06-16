import {name} from "../package.json";

export default {
    COMMON: {
        project: name,
        region: "us-east-1",
        account: "026090449790"
    },
    HOSTING: {
        hostedZoneID: "Z1O5PNX51MI59R",
        hostedZoneName: "oleksiipopov.com",
        domainName: "configuration-service.examples.oleksiipopov.com"
    },
    CLIENTS: {
        ALLOWED_ORIGINS: [
            "http://127.0.0.1:9000",
            "http://localhost:9000",
            "https://prod.config-demo.examples.oleksiipopov.com",
            "https://acc.config-demo.examples.oleksiipopov.com"
        ],
        ALLOWED_ORIGIN_ENDS: [
            "dev.config-demo.examples.oleksiipopov.com"
        ],
        ALLOWED_ENVIRONMENTS: [
            "production-by-key",
            "default"
        ],
        FALLBACK_ORIGIN: "https://prod.config-demo.examples.oleksiipopov.com",
        FALLBACK_ENVIRONMENT: "default"
    }
};
