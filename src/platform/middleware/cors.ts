import type { MiddlewareHandler } from "hono";
import { cors as corsMiddleware } from "hono/cors";
import type { Config } from "../../config/config.ts";

export function cors(cfg: Config): MiddlewareHandler {
  const origins = cfg.http.cors_allow_origins;
  const origin: string | string[] =
    origins.length === 0 || (origins.length === 1 && origins[0] === "*") ? "*" : origins;

  return corsMiddleware({
    origin,
    allowMethods: cfg.http.cors_allow_methods,
    allowHeaders: cfg.http.cors_allow_headers,
    exposeHeaders: ["Content-Length"],
    maxAge: 86400,
  });
}
