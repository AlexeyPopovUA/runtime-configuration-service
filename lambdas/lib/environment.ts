import cfg from "../../cfg/configuration";

/**
 * Checks if environment is in the white list
 */
export const isEnvironmentAllowed = (environment: string) => cfg.CLIENTS.ALLOWED_ENVIRONMENTS.some(allowed_env => environment === allowed_env);

/**
 * Checks if origin is in the white list
 */
export const isOriginAllowed = (origin: string) =>
    cfg.CLIENTS.ALLOWED_ORIGINS.some((allowedOrigin) => origin.startsWith(allowedOrigin)) || cfg.CLIENTS.ALLOWED_ORIGIN_ENDS.some((originEnd) => origin.includes(originEnd));
