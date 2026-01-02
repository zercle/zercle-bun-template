import { Context, Next } from 'hono';
import { cors } from 'hono/cors';
import { CORSConfig } from '../config/config.js';

export function createCorsMiddleware(config: CORSConfig) {
  return cors({
    origin: config.allowed_origins,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true,
    maxAge: 86400,
  });
}
