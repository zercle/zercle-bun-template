import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { IUserService} from '../usecase/user.js';
import { ErrUserNotFound, ErrUserAlreadyExists, ErrInvalidCredentials } from '../usecase/user.js';
import { registerUserSchema, loginUserSchema, updateUserSchema } from '../request/user.js';
import { success, created, noContent, badRequest, unauthorized, notFound, conflict, internalError } from '../../../utils/response.js';
import { getRequestID, getUserId } from '../../../infrastructure/middleware/auth.js';
import type { Logger } from '../../../infrastructure/logger/logger.js';

export class UserHandler {
  constructor(
    private useCase: IUserService,
    private logger: Logger,
  ) {}

  async register(c: Context) {
    const requestId = getRequestID(c);

    try {
      const body = await c.req.json();
      const validatedData = registerUserSchema.parse(body);

      const result = await this.useCase.register(validatedData);

      this.logger.info('User registered successfully', {
        request_id: requestId,
        email: validatedData.email,
      });

      return created(c, result);
    } catch (error) {
      if (error instanceof ErrUserAlreadyExists) {
        return conflict(c, 'Email already exists');
      }
      if (error instanceof Error && error.name === 'ZodError') {
        return badRequest(c, 'Validation failed', this.formatZodError(error));
      }
      this.logger.error('Failed to register user', {
        request_id: requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return internalError(c, 'Failed to register user');
    }
  }

  async login(c: Context) {
    const requestId = getRequestID(c);

    try {
      const body = await c.req.json();
      const validatedData = loginUserSchema.parse(body);

      const result = await this.useCase.login(validatedData);

      this.logger.info('User logged in successfully', {
        request_id: requestId,
        email: validatedData.email,
      });

      return success(c, result);
    } catch (error) {
      if (error instanceof ErrInvalidCredentials) {
        return unauthorized(c, 'Invalid email or password');
      }
      if (error instanceof Error && error.name === 'ZodError') {
        return badRequest(c, 'Validation failed', this.formatZodError(error));
      }
      this.logger.error('Failed to login user', {
        request_id: requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return internalError(c, 'Failed to login user');
    }
  }

  async getProfile(c: Context) {
    const requestId = getRequestID(c);
    const userId = getUserId(c);

    if (!userId) {
      return unauthorized(c, 'Invalid token');
    }

    try {
      const result = await this.useCase.getProfile(userId);

      return success(c, result);
    } catch (error) {
      if (error instanceof ErrUserNotFound) {
        return notFound(c, 'User not found');
      }
      this.logger.error('Failed to get user profile', {
        request_id: requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return internalError(c, 'Failed to get user profile');
    }
  }

  async updateProfile(c: Context) {
    const requestId = getRequestID(c);
    const userId = getUserId(c);

    if (!userId) {
      return unauthorized(c, 'Invalid token');
    }

    try {
      const body = await c.req.json();
      const validatedData = updateUserSchema.parse(body);

      const result = await this.useCase.updateProfile(userId, validatedData);

      this.logger.info('User profile updated successfully', {
        request_id: requestId,
        user_id: userId,
      });

      return success(c, result);
    } catch (error) {
      if (error instanceof ErrUserNotFound) {
        return notFound(c, 'User not found');
      }
      if (error instanceof Error && error.name === 'ZodError') {
        return badRequest(c, 'Validation failed', this.formatZodError(error));
      }
      this.logger.error('Failed to update user profile', {
        request_id: requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return internalError(c, 'Failed to update user profile');
    }
  }

  async deleteAccount(c: Context) {
    const requestId = getRequestID(c);
    const userId = getUserId(c);

    if (!userId) {
      return unauthorized(c, 'Invalid token');
    }

    try {
      await this.useCase.deleteAccount(userId);

      this.logger.info('User account deleted successfully', {
        request_id: requestId,
        user_id: userId,
      });

      return noContent(c);
    } catch (error) {
      if (error instanceof ErrUserNotFound) {
        return notFound(c, 'User not found');
      }
      this.logger.error('Failed to delete user account', {
        request_id: requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return internalError(c, 'Failed to delete user account');
    }
  }

  async listUsers(c: Context) {
    const requestId = getRequestID(c);

    try {
      const limit = this.parseLimit(c.req.query('limit'));
      const offset = this.parseOffset(c.req.query('offset'));

      const result = await this.useCase.listUsers(limit, offset);

      return success(c, result, { limit, offset });
    } catch (error) {
      this.logger.error('Failed to list users', {
        request_id: requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return internalError(c, 'Failed to list users');
    }
  }

  private parseLimit(limit?: string): number {
    const parsed = parseInt(limit || '20', 10);
    if (parsed <= 0 || parsed > 100) {
      return 20;
    }
    return parsed;
  }

  private parseOffset(offset?: string): number {
    const parsed = parseInt(offset || '0', 10);
    if (parsed < 0) {
      return 0;
    }
    return parsed;
  }

  private formatZodError(error: Error): Record<string, string[]> {
    if (error.name === 'ZodError' && 'issues' in error) {
      const issues = (error as any).issues;
      const errors: Record<string, string[]> = {};

      for (const issue of issues) {
        const path = issue.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(issue.message);
      }

      return errors;
    }

    return {};
  }
}
