import { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';
import { JWTConfig } from '../config/config.js';

export interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export interface AuthContext {
  userId: string;
  email: string;
}

export function createAuthMiddleware(config: JWTConfig) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ status: 'error', message: 'Missing or invalid authorization header' }, 401);
    }

    const token = authHeader.substring(7);

    try {
      const payload = jwt.verify(token, config.secret) as JWTPayload;

      // Add user info to context
      c.set('userId', payload.userId);
      c.set('email', payload.email);

      await next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return c.json({ status: 'error', message: 'Token expired' }, 401);
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return c.json({ status: 'error', message: 'Invalid token' }, 401);
      }
      return c.json({ status: 'error', message: 'Authentication failed' }, 401);
    }
  };
}

export function generateToken(userId: string, email: string, config: JWTConfig): string {
  const payload = {
    userId,
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + config.expiration,
  };

  return jwt.sign(payload, config.secret);
}

export function getUserId(c: Context): string {
  return c.get('userId') as string;
}

export function getEmail(c: Context): string {
  return c.get('email') as string;
}
