import type { Task, CreateTask, UpdateTask } from '../../src/domain/task/entity/task.js';
import type { ITaskRepository } from '../../src/domain/task/repository/task.js';
import type { User, CreateUser, UpdateUser } from '../../src/domain/user/entity/user.js';
import type { IUserRepository } from '../../src/domain/user/repository/user.js';
import type { Logger } from '../../src/infrastructure/logger/logger.js';

// ============ Mock Logger ============

export class MockLogger implements Logger {
  private logs: Array<{ level: string; message: string; meta?: Record<string, unknown> }> = [];

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: 'debug', message, meta });
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: 'info', message, meta });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: 'warn', message, meta });
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: 'error', message, meta });
  }

  fatal(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: 'fatal', message, meta });
  }

  child(bindings: Record<string, unknown>): Logger {
    const childLogger = new MockLogger();
    childLogger.logs = [...this.logs];
    return childLogger;
  }

  getLogs(): Array<{ level: string; message: string; meta?: Record<string, unknown> }> {
    return this.logs;
  }

  clearLogs(): void {
    this.logs = [];
  }
}

// ============ Mock Task Repository ============

export class MockTaskRepository implements ITaskRepository {
  private tasks: Map<string, Task> = new Map();
  private logger: MockLogger;

  constructor(logger: MockLogger) {
    this.logger = logger;
  }

  setTasks(tasks: Task[]): void {
    this.tasks.clear();
    for (const task of tasks) {
      this.tasks.set(task.id, task);
    }
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  async create(task: CreateTask): Promise<Task> {
    const now = new Date();
    const newTask: Task = {
      id: `task-${Date.now()}`,
      userId: task.userId,
      title: task.title,
      description: task.description,
      status: task.status || 'pending',
      priority: task.priority || 'medium',
      dueDate: task.dueDate,
      completedAt: undefined,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(newTask.id, newTask);
    return newTask;
  }

  async getByID(id: string): Promise<Task | null> {
    return this.tasks.get(id) || null;
  }

  async listByUser(userId: string, limit: number, offset: number): Promise<{ tasks: Task[]; total: number }> {
    const userTasks = Array.from(this.tasks.values()).filter((t) => t.userId === userId);
    const total = userTasks.length;
    const paginatedTasks = userTasks.slice(offset, offset + limit);
    return { tasks: paginatedTasks, total };
  }

  async update(id: string, userId: string, task: UpdateTask): Promise<Task | null> {
    const existing = this.tasks.get(id);
    if (!existing || existing.userId !== userId) {
      return null;
    }

    const updated: Task = {
      ...existing,
      ...task,
      updatedAt: new Date(),
      completedAt: task.status === 'completed' ? new Date() : existing.completedAt,
    };
    this.tasks.set(id, updated);
    return updated;
  }

  async delete(id: string, userId: string): Promise<void> {
    const existing = this.tasks.get(id);
    if (existing && existing.userId === userId) {
      this.tasks.delete(id);
    }
  }
}

// ============ Mock User Repository ============

export class MockUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();
  private emailIndex: Map<string, string> = new Map(); // email -> id
  private logger: MockLogger;

  constructor(logger: MockLogger) {
    this.logger = logger;
  }

  setUsers(users: User[]): void {
    this.users.clear();
    this.emailIndex.clear();
    for (const user of users) {
      this.users.set(user.id, user);
      this.emailIndex.set(user.email, user.id);
    }
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  async create(user: CreateUser): Promise<User> {
    const now = new Date();
    const newUser: User = {
      id: `user-${Date.now()}`,
      email: user.email,
      password: user.password,
      fullName: user.fullName,
      phone: user.phone,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(newUser.id, newUser);
    this.emailIndex.set(newUser.email, newUser.id);
    return newUser;
  }

  async getByID(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async getByEmail(email: string): Promise<User | null> {
    const id = this.emailIndex.get(email);
    if (id) {
      return this.users.get(id) || null;
    }
    return null;
  }

  async update(id: string, user: UpdateUser): Promise<User | null> {
    const existing = this.users.get(id);
    if (!existing) {
      return null;
    }

    const updated: User = {
      ...existing,
      fullName: user.fullName || existing.fullName,
      phone: user.phone !== undefined ? user.phone : existing.phone,
      updatedAt: new Date(),
    };
    this.users.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const existing = this.users.get(id);
    if (existing) {
      this.emailIndex.delete(existing.email);
      this.users.delete(id);
    }
  }

  async list(limit: number, offset: number): Promise<{ users: User[]; total: number }> {
    const allUsers = Array.from(this.users.values());
    const total = allUsers.length;
    const paginatedUsers = allUsers.slice(offset, offset + limit);
    return { users: paginatedUsers, total };
  }
}

// ============ Mock Passworder ============

export class MockPassworder {
  private hashStore: Map<string, string> = new Map(); // password -> hash

  async hashPassword(password: string): Promise<string> {
    const hash = `mock_hash_${password}_${Date.now()}`;
    this.hashStore.set(password, hash);
    return hash;
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const storedHash = this.hashStore.get(password);
    if (storedHash && storedHash.startsWith(`mock_hash_${password}_`)) {
      return true;
    }
    return hash === `mock_hash_${password}_123`;
  }
}

// ============ Helper Functions ============

export function createMockTask(overrides: Partial<Task> = {}): Task {
  const now = new Date();
  return {
    id: `task-${Math.random().toString(36).substring(7)}`,
    userId: 'user-123',
    title: 'Test Task',
    description: 'Test description',
    status: 'pending',
    priority: 'medium',
    dueDate: undefined,
    completedAt: undefined,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createMockUser(overrides: Partial<User> = {}): User {
  const now = new Date();
  return {
    id: `user-${Math.random().toString(36).substring(7)}`,
    email: 'test@example.com',
    password: 'hashed_password',
    fullName: 'Test User',
    phone: undefined,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createMockUserWithPassword(overrides: Partial<User> = {}): User {
  return createMockUser({
    password: 'mock_hash_password_123',
    ...overrides,
  });
}

// Pre-defined mock tasks
export const mockTasks: Task[] = [
  createMockTask({
    id: 'task-pending-1',
    status: 'pending',
    priority: 'low',
    title: 'Pending Task 1',
  }),
  createMockTask({
    id: 'task-pending-2',
    status: 'pending',
    priority: 'high',
    title: 'Pending Task 2',
  }),
  createMockTask({
    id: 'task-in-progress-1',
    status: 'in_progress',
    priority: 'medium',
    title: 'In Progress Task',
  }),
  createMockTask({
    id: 'task-completed-1',
    status: 'completed',
    priority: 'urgent',
    title: 'Completed Task',
    completedAt: new Date(),
  }),
];

// Pre-defined mock users
export const mockUsers: User[] = [
  createMockUserWithPassword({
    id: 'user-1',
    email: 'user1@example.com',
    fullName: 'User One',
  }),
  createMockUserWithPassword({
    id: 'user-2',
    email: 'user2@example.com',
    fullName: 'User Two',
  }),
];

// ============ Mock Context ============

export interface MockContextOptions {
  userId?: string | null;
  param?: string;
  query?: Record<string, string>;
  json?: Record<string, unknown>;
}

export class MockContext {
  private options: MockContextOptions;
  private responseData: unknown = null;
  private responseStatus: number = 200;
  private responseHeaders: Map<string, string> = new Map();

  constructor(options: MockContextOptions = {}) {
    this.options = options;
  }

  getRequestID(): string {
    return 'test-request-id';
  }

  getUserId(): string | null {
    return this.options.userId || null;
  }

  req = {
    json: async () => this.options.json || {},
    param: (name: string) => this.options.param || '',
    query: (name: string) => this.options.query?.[name] || '',
  };

  setStatus(status: number): void {
    this.responseStatus = status;
  }

  setData(data: unknown): void {
    this.responseData = data;
  }

  setHeader(name: string, value: string): void {
    this.responseHeaders.set(name, value);
  }

  getResponseStatus(): number {
    return this.responseStatus;
  }

  getResponseData(): unknown {
    return this.responseData;
  }

  getResponseHeaders(): Map<string, string> {
    return this.responseHeaders;
  }
}
