import { Task, CreateTask, UpdateTask } from '../entity/task.js';
import { ITaskRepository } from '../repository/task.js';
import { CreateTask as CreateTaskDTO, UpdateTask as UpdateTaskDTO } from '../request/task.js';
import { TaskResponse, ListTasksResponse } from '../response/task.js';
import { Logger } from '../../../infrastructure/logger/logger.js';

export class ErrTaskNotFound extends Error {
  constructor() {
    super('Task not found');
    this.name = 'ErrTaskNotFound';
  }
}

export class ErrUnauthorizedTask extends Error {
  constructor() {
    super('Unauthorized access to task');
    this.name = 'ErrUnauthorizedTask';
  }
}

export interface ITaskService {
  createTask(userId: string, task: CreateTaskDTO): Promise<TaskResponse>;
  getTask(id: string, userId: string): Promise<TaskResponse>;
  listTasks(userId: string, limit: number, offset: number): Promise<ListTasksResponse>;
  updateTask(id: string, userId: string, task: UpdateTaskDTO): Promise<TaskResponse>;
  deleteTask(id: string, userId: string): Promise<void>;
}

export class TaskUseCase implements ITaskService {
  constructor(
    private repo: ITaskRepository,
    private logger: Logger,
  ) {}

  async createTask(userId: string, task: CreateTaskDTO): Promise<TaskResponse> {
    const createTask: CreateTask = {
      userId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
    };

    const created = await this.repo.create(createTask);

    return {
      id: created.id,
      userId: created.userId,
      title: created.title,
      description: created.description,
      status: created.status,
      priority: created.priority,
      dueDate: created.dueDate,
      completedAt: created.completedAt,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async getTask(id: string, userId: string): Promise<TaskResponse> {
    const task = await this.repo.getByID(id);
    if (!task) {
      throw new ErrTaskNotFound();
    }

    // Check ownership
    if (task.userId !== userId) {
      throw new ErrUnauthorizedTask();
    }

    return {
      id: task.id,
      userId: task.userId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      completedAt: task.completedAt,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  async listTasks(userId: string, limit: number, offset: number): Promise<ListTasksResponse> {
    const { tasks, total } = await this.repo.listByUser(userId, limit, offset);

    return {
      tasks: tasks.map((t) => ({
        id: t.id,
        userId: t.userId,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        completedAt: t.completedAt,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      total,
    };
  }

  async updateTask(id: string, userId: string, task: UpdateTaskDTO): Promise<TaskResponse> {
    // Check if task exists and belongs to user
    const existing = await this.repo.getByID(id);
    if (!existing) {
      throw new ErrTaskNotFound();
    }

    if (existing.userId !== userId) {
      throw new ErrUnauthorizedTask();
    }

    const updateTask: UpdateTask = {
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
    };

    const updated = await this.repo.update(id, userId, updateTask);

    return {
      id: updated.id,
      userId: updated.userId,
      title: updated.title,
      description: updated.description,
      status: updated.status,
      priority: updated.priority,
      dueDate: updated.dueDate,
      completedAt: updated.completedAt,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteTask(id: string, userId: string): Promise<void> {
    // Check if task exists and belongs to user
    const existing = await this.repo.getByID(id);
    if (!existing) {
      throw new ErrTaskNotFound();
    }

    if (existing.userId !== userId) {
      throw new ErrUnauthorizedTask();
    }

    await this.repo.delete(id, userId);
  }
}
