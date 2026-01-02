import type { Context } from 'hono';
import type { ITaskService} from '../usecase/task.js';
import { ErrTaskNotFound, ErrUnauthorizedTask } from '../usecase/task.js';
import { createTaskSchema, updateTaskSchema } from '../request/task.js';
import { success, created, noContent, badRequest, notFound, forbidden, internalError } from '../../../utils/response.js';
import { getRequestID, getUserId } from '../../../infrastructure/middleware/auth.js';
import type { Logger } from '../../../infrastructure/logger/logger.js';

export class TaskHandler {
  constructor(
    private useCase: ITaskService,
    private logger: Logger,
  ) {}

  async createTask(c: Context) {
    const requestId = getRequestID(c);
    const userId = getUserId(c);

    if (!userId) {
      return forbidden(c, 'Authentication required');
    }

    try {
      const body = await c.req.json();
      const validatedData = createTaskSchema.parse(body);

      const result = await this.useCase.createTask(userId, validatedData);

      this.logger.info('Task created successfully', {
        request_id: requestId,
        user_id: userId,
        task_id: result.id,
      });

      return created(c, result);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return badRequest(c, 'Validation failed', this.formatZodError(error));
      }
      this.logger.error('Failed to create task', {
        request_id: requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return internalError(c, 'Failed to create task');
    }
  }

  async getTask(c: Context) {
    const requestId = getRequestID(c);
    const userId = getUserId(c);
    const taskId = c.req.param('id');

    if (!userId) {
      return forbidden(c, 'Authentication required');
    }

    try {
      const result = await this.useCase.getTask(taskId, userId);

      return success(c, result);
    } catch (error) {
      if (error instanceof ErrTaskNotFound) {
        return notFound(c, 'Task not found');
      }
      if (error instanceof ErrUnauthorizedTask) {
        return forbidden(c, 'You do not have access to this task');
      }
      this.logger.error('Failed to get task', {
        request_id: requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return internalError(c, 'Failed to get task');
    }
  }

  async listTasks(c: Context) {
    const requestId = getRequestID(c);
    const userId = getUserId(c);

    if (!userId) {
      return forbidden(c, 'Authentication required');
    }

    try {
      const limit = this.parseLimit(c.req.query('limit'));
      const offset = this.parseOffset(c.req.query('offset'));

      const result = await this.useCase.listTasks(userId, limit, offset);

      return success(c, result, { limit, offset });
    } catch (error) {
      this.logger.error('Failed to list tasks', {
        request_id: requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return internalError(c, 'Failed to list tasks');
    }
  }

  async updateTask(c: Context) {
    const requestId = getRequestID(c);
    const userId = getUserId(c);
    const taskId = c.req.param('id');

    if (!userId) {
      return forbidden(c, 'Authentication required');
    }

    try {
      const body = await c.req.json();
      const validatedData = updateTaskSchema.parse(body);

      const result = await this.useCase.updateTask(taskId, userId, validatedData);

      this.logger.info('Task updated successfully', {
        request_id: requestId,
        user_id: userId,
        task_id: taskId,
      });

      return success(c, result);
    } catch (error) {
      if (error instanceof ErrTaskNotFound) {
        return notFound(c, 'Task not found');
      }
      if (error instanceof ErrUnauthorizedTask) {
        return forbidden(c, 'You do not have access to this task');
      }
      if (error instanceof Error && error.name === 'ZodError') {
        return badRequest(c, 'Validation failed', this.formatZodError(error));
      }
      this.logger.error('Failed to update task', {
        request_id: requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return internalError(c, 'Failed to update task');
    }
  }

  async deleteTask(c: Context) {
    const requestId = getRequestID(c);
    const userId = getUserId(c);
    const taskId = c.req.param('id');

    if (!userId) {
      return forbidden(c, 'Authentication required');
    }

    try {
      await this.useCase.deleteTask(taskId, userId);

      this.logger.info('Task deleted successfully', {
        request_id: requestId,
        user_id: userId,
        task_id: taskId,
      });

      return noContent(c);
    } catch (error) {
      if (error instanceof ErrTaskNotFound) {
        return notFound(c, 'Task not found');
      }
      if (error instanceof ErrUnauthorizedTask) {
        return forbidden(c, 'You do not have access to this task');
      }
      this.logger.error('Failed to delete task', {
        request_id: requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return internalError(c, 'Failed to delete task');
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
