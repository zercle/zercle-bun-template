import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { AppError, ErrorCode } from '../../../../shared/errors/app-error';
import type { AuthServiceInterface } from '../../service/interface';

// Validation schemas
const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8),
  display_name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refresh_token: z.string(),
});

export class AuthHandler {
  constructor(private readonly authService: AuthServiceInterface) {}

  registerRoutes(app: Hono): void {
    const auth = new Hono();

    // POST /auth/register
    auth.post('/register', zValidator('json', registerSchema), async (c) => {
      const body = c.req.valid('json');

      const result = await this.authService.register({
        username: body.username,
        email: body.email,
        password: body.password,
        displayName: body.display_name ?? body.username,
      });

      return c.json(
        {
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
          user: {
            id: result.user.id,
            username: result.user.username,
            email: result.user.email,
            display_name: result.user.displayName,
            avatar_url: result.user.avatarUrl,
            status: result.user.status,
          },
          expires_at: result.expiresAt,
        },
        201,
      );
    });

    // POST /auth/login
    auth.post('/login', zValidator('json', loginSchema), async (c) => {
      const body = c.req.valid('json');

      const result = await this.authService.login({
        email: body.email,
        password: body.password,
      });

      return c.json({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        user: {
          id: result.user.id,
          username: result.user.username,
          email: result.user.email,
          display_name: result.user.displayName,
          avatar_url: result.user.avatarUrl,
          status: result.user.status,
        },
        expires_at: result.expiresAt,
      });
    });

    // POST /auth/refresh
    auth.post('/refresh', zValidator('json', refreshSchema), async (c) => {
      const { refresh_token } = c.req.valid('json');

      const result = await this.authService.refreshToken(refresh_token);

      return c.json({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        user: {
          id: result.user.id,
          username: result.user.username,
          email: result.user.email,
          display_name: result.user.displayName,
          avatar_url: result.user.avatarUrl,
          status: result.user.status,
        },
        expires_at: result.expiresAt,
      });
    });

    // GET /auth/me - requires auth middleware
    auth.get('/me', async (c) => {
      const authHeader = c.req.header('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        throw new AppError(
          ErrorCode.UNAUTHORIZED,
          'missing authorization header',
        );
      }
      const token = authHeader.slice(7);

      const user = await this.authService.validateToken(token);

      return c.json({
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.displayName,
        avatar_url: user.avatarUrl,
        status: user.status,
      });
    });

    // POST /auth/logout - requires auth middleware
    auth.post('/logout', async (c) => {
      const authHeader = c.req.header('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        throw new AppError(
          ErrorCode.UNAUTHORIZED,
          'missing authorization header',
        );
      }
      const token = authHeader.slice(7);

      const user = await this.authService.validateToken(token);
      await this.authService.logout(user.id);
      return c.body(null, 204);
    });

    // Mount under /auth
    app.route('/auth', auth);
  }
}
