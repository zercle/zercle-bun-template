import type {
  Task,
  CreateTask,
  UpdateTask,
} from "../../src/domain/task/entity/task.js";
import type { ITaskRepository } from "../../src/domain/task/repository/task.js";
import type {
  User,
  CreateUser,
  UpdateUser,
} from "../../src/domain/user/entity/user.js";
import type { IUserRepository } from "../../src/domain/user/repository/user.js";
import type { Logger } from "../../src/infrastructure/logger/logger.js";
import { describe, test, expect } from "bun:test";

// ============ Mock Logger ============

export class MockLogger implements Logger {
  private logs: Array<{
    level: string;
    message: string;
    meta?: Record<string, unknown>;
  }> = [];

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: "debug", message, meta });
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: "info", message, meta });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: "warn", message, meta });
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: "error", message, meta });
  }

  fatal(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: "fatal", message, meta });
  }

  child(bindings: Record<string, unknown>): Logger {
    const childLogger = new MockLogger();
    childLogger.logs = [...this.logs];
    return childLogger;
  }

  getLogs(): Array<{
    level: string;
    message: string;
    meta?: Record<string, unknown>;
  }> {
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
      id: `task-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      userId: task.userId,
      title: task.title,
      description: task.description,
      status: task.status || "pending",
      priority: task.priority || "medium",
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

  async listByUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ tasks: Task[]; total: number }> {
    const userTasks = Array.from(this.tasks.values()).filter(
      (t) => t.userId === userId,
    );
    const total = userTasks.length;
    const paginatedTasks = userTasks.slice(offset, offset + limit);
    return { tasks: paginatedTasks, total };
  }

  async update(
    id: string,
    userId: string,
    task: UpdateTask,
  ): Promise<Task | null> {
    const existing = this.tasks.get(id);
    if (!existing || existing.userId !== userId) {
      return null;
    }

    const updated: Task = {
      ...existing,
      ...task,
      updatedAt: new Date(),
      completedAt:
        task.status === "completed" ? new Date() : existing.completedAt,
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
      id: `user-${Date.now()}-${Math.random().toString(36).substring(7)}`,
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

  async list(
    limit: number,
    offset: number,
  ): Promise<{ users: User[]; total: number }> {
    const allUsers = Array.from(this.users.values());
    const total = allUsers.length;
    const paginatedUsers = allUsers.slice(offset, offset + limit);
    return { users: paginatedUsers, total };
  }

  async verifyPassword(email: string, password: string): Promise<User | null> {
    const user = await this.getByEmail(email);
    if (!user) return null;
    return user;
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
    userId: "user-123",
    title: "Test Task",
    description: "Test description",
    status: "pending",
    priority: "medium",
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
    email: "test@example.com",
    password: "hashed_password",
    fullName: "Test User",
    phone: undefined,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createMockUserWithPassword(
  overrides: Partial<User> = {},
): User {
  return createMockUser({
    password: "mock_hash_password_123",
    ...overrides,
  });
}

// Pre-defined mock tasks
export const mockTasks: Task[] = [
  createMockTask({
    id: "task-pending-1",
    status: "pending",
    priority: "low",
    title: "Pending Task 1",
  }),
  createMockTask({
    id: "task-pending-2",
    status: "pending",
    priority: "high",
    title: "Pending Task 2",
  }),
  createMockTask({
    id: "task-in-progress-1",
    status: "in_progress",
    priority: "medium",
    title: "In Progress Task",
  }),
  createMockTask({
    id: "task-completed-1",
    status: "completed",
    priority: "urgent",
    title: "Completed Task",
    completedAt: new Date(),
  }),
];

// Pre-defined mock users
export const mockUsers: User[] = [
  createMockUserWithPassword({
    id: "user-1",
    email: "user1@example.com",
    fullName: "User One",
  }),
  createMockUserWithPassword({
    id: "user-2",
    email: "user2@example.com",
    fullName: "User Two",
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
    return "test-request-id";
  }

  getUserId(): string | null {
    return this.options.userId || null;
  }

  req = {
    json: async () => this.options.json || {},
    param: (name: string) => this.options.param || "",
    query: (name: string) => this.options.query?.[name] || "",
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

// ============ Tests ============

describe("MockLogger", () => {
  test("should log messages at different levels", () => {
    const logger = new MockLogger();
    logger.debug("debug message");
    logger.info("info message");
    logger.warn("warn message");
    logger.error("error message");
    logger.fatal("fatal message");

    const logs = logger.getLogs();
    expect(logs).toHaveLength(5);
    expect(logs[0].level).toBe("debug");
    expect(logs[1].level).toBe("info");
    expect(logs[2].level).toBe("warn");
    expect(logs[3].level).toBe("error");
    expect(logs[4].level).toBe("fatal");
  });

  test("should clear logs", () => {
    const logger = new MockLogger();
    logger.info("test message");
    expect(logger.getLogs()).toHaveLength(1);
    logger.clearLogs();
    expect(logger.getLogs()).toHaveLength(0);
  });
});

describe("MockTaskRepository", () => {
  test("should create a task", async () => {
    const logger = new MockLogger();
    const repository = new MockTaskRepository(logger);

    const task = await repository.create({
      userId: "user-123",
      title: "New Task",
      description: "Task description",
    });

    expect(task).toBeDefined();
    expect(task.title).toBe("New Task");
    expect(task.userId).toBe("user-123");
    expect(task.status).toBe("pending");
  });

  test("should get task by ID", async () => {
    const logger = new MockLogger();
    const repository = new MockTaskRepository(logger);

    const created = await repository.create({
      userId: "user-123",
      title: "Test Task",
    });

    const found = await repository.getByID(created.id);
    expect(found).not.toBeNull();
    expect(found?.title).toBe("Test Task");
  });

  test("should return null for non-existent task", async () => {
    const logger = new MockLogger();
    const repository = new MockTaskRepository(logger);

    const result = await repository.getByID("non-existent-id");
    expect(result).toBeNull();
  });

  test("should list tasks by user", async () => {
    const logger = new MockLogger();
    const repository = new MockTaskRepository(logger);

    await repository.create({
      userId: "user-1",
      title: "Task 1",
    });
    await repository.create({
      userId: "user-1",
      title: "Task 2",
    });
    await repository.create({
      userId: "user-2",
      title: "Task 3",
    });

    const result = await repository.listByUser("user-1", 10, 0);
    expect(result.tasks).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  test("should update task", async () => {
    const logger = new MockLogger();
    const repository = new MockTaskRepository(logger);

    const created = await repository.create({
      userId: "user-123",
      title: "Original Title",
    });

    const updated = await repository.update(created.id, "user-123", {
      title: "Updated Title",
      status: "completed",
    });

    expect(updated).not.toBeNull();
    expect(updated?.title).toBe("Updated Title");
    expect(updated?.status).toBe("completed");
  });

  test("should delete task", async () => {
    const logger = new MockLogger();
    const repository = new MockTaskRepository(logger);

    const created = await repository.create({
      userId: "user-123",
      title: "Task to Delete",
    });

    await repository.delete(created.id, "user-123");

    const result = await repository.getByID(created.id);
    expect(result).toBeNull();
  });
});

describe("MockUserRepository", () => {
  test("should create a user", async () => {
    const logger = new MockLogger();
    const repository = new MockUserRepository(logger);

    const user = await repository.create({
      email: "test@example.com",
      password: "hashed_password",
      fullName: "Test User",
    });

    expect(user).toBeDefined();
    expect(user.email).toBe("test@example.com");
    expect(user.fullName).toBe("Test User");
    expect(user.isActive).toBe(true);
  });

  test("should get user by email", async () => {
    const logger = new MockLogger();
    const repository = new MockUserRepository(logger);

    await repository.create({
      email: "findme@example.com",
      password: "password",
      fullName: "Find Me",
    });

    const found = await repository.getByEmail("findme@example.com");
    expect(found).not.toBeNull();
    expect(found?.fullName).toBe("Find Me");
  });

  test("should update user", async () => {
    const logger = new MockLogger();
    const repository = new MockUserRepository(logger);

    const created = await repository.create({
      email: "update@example.com",
      password: "password",
      fullName: "Original Name",
    });

    const updated = await repository.update(created.id, {
      fullName: "Updated Name",
      phone: "123-456-7890",
    });

    expect(updated).not.toBeNull();
    expect(updated?.fullName).toBe("Updated Name");
    expect(updated?.phone).toBe("123-456-7890");
  });

  test("should delete user", async () => {
    const logger = new MockLogger();
    const repository = new MockUserRepository(logger);

    const created = await repository.create({
      email: "delete@example.com",
      password: "password",
      fullName: "Delete Me",
    });

    await repository.delete(created.id);

    const result = await repository.getByID(created.id);
    expect(result).toBeNull();
  });

  test("should list users with pagination", async () => {
    const logger = new MockLogger();
    const repository = new MockUserRepository(logger);

    for (let i = 0; i < 5; i++) {
      await repository.create({
        email: `user${i}@example.com`,
        password: "password",
        fullName: `User ${i}`,
      });
    }

    const result = await repository.list(2, 0);
    expect(result.users).toHaveLength(2);
    expect(result.total).toBe(5);
  });
});

describe("MockPassworder", () => {
  test("should hash password", async () => {
    const passworder = new MockPassworder();

    const hash = await passworder.hashPassword("myPassword");

    expect(hash).toBeDefined();
    expect(hash).toContain("myPassword");
  });

  test("should verify correct password", async () => {
    const passworder = new MockPassworder();

    const hash = await passworder.hashPassword("myPassword");
    const isValid = await passworder.verifyPassword("myPassword", hash);

    expect(isValid).toBe(true);
  });

  test("should reject incorrect password", async () => {
    const passworder = new MockPassworder();

    const hash = await passworder.hashPassword("myPassword");
    const isValid = await passworder.verifyPassword("wrongPassword", hash);

    expect(isValid).toBe(false);
  });
});

describe("Helper Functions", () => {
  test("createMockTask should create task with defaults", () => {
    const task = createMockTask();

    expect(task).toBeDefined();
    expect(task.title).toBe("Test Task");
    expect(task.status).toBe("pending");
    expect(task.priority).toBe("medium");
    expect(task.userId).toBe("user-123");
  });

  test("createMockUser should create user with defaults", () => {
    const user = createMockUser();

    expect(user).toBeDefined();
    expect(user.email).toBe("test@example.com");
    expect(user.fullName).toBe("Test User");
    expect(user.isActive).toBe(true);
  });

  test("mockTasks should have predefined tasks", () => {
    expect(mockTasks).toHaveLength(4);
    expect(mockTasks[0].status).toBe("pending");
    expect(mockTasks[3].status).toBe("completed");
  });

  test("mockUsers should have predefined users", () => {
    expect(mockUsers).toHaveLength(2);
    expect(mockUsers[0].email).toBe("user1@example.com");
    expect(mockUsers[1].email).toBe("user2@example.com");
  });
});
