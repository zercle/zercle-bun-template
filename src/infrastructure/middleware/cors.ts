import { cors as corsMiddleware } from "@elysiajs/cors";
import type { Config } from "../config/config.ts";

/**
 * CORS policy built from the configured origins, methods, and headers.
 *
 * Elysia's plugin takes a concrete origin list; an empty list means "any
 * origin", which the plugin spells as `true` (reflect the request origin).
 */
export function cors(cfg: Config) {
  const origins = cfg.http.cors_allow_origins;
  const origin = origins.length === 0 ? true : origins;

  return corsMiddleware({
    origin,
    methods: cfg.http.cors_allow_methods,
    allowedHeaders: cfg.http.cors_allow_headers,
    exposeHeaders: ["Content-Length"],
    maxAge: 86400,
  });
}
