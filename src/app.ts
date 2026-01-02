import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { Config } from "./infrastructure/config/config.js";
import { DrizzleDatabase } from "./infrastructure/db/drizzle.js";
import { Logger } from "./infrastructure/logger/logger.js";
import { Passworder } from "./infrastructure/password/passworder.js";
import { createRequestIDMiddleware } from "./infrastructure/middleware/request-id.js";
import { createLoggerMiddleware } from "./infrastructure/middleware/logger.js";
import { createCorsMiddleware } from "./infrastructure/middleware/cors.js";
import { createRateLimitMiddleware } from "./infrastructure/middleware/rate-limit.js";
import { createAuthMiddleware } from "./infrastructure/middleware/auth.js";
import { UserRepository } from "./domain/user/repository/user.js";
import { UserUseCase } from "./domain/user/usecase/user.js";
import { UserHandler } from "./domain/user/handler/user.js";
import { TaskRepository } from "./domain/task/repository/task.js";
import { TaskUseCase } from "./domain/task/usecase/task.js";
import { TaskHandler } from "./domain/task/handler/task.js";
import { success } from "./utils/response.js";

export class App {
  private hono: Hono;
  private db: DrizzleDatabase;
  private logger: Logger;
  private config: Config;
  private server: ReturnType<typeof serve>;

  constructor(config: Config) {
    this.config = config;
    this.logger = new Logger(config.logging);
    this.db = new DrizzleDatabase(config.database);
    this.hono = new Hono();

    this.setupMiddleware();
    this.setupDependencies();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // Request ID middleware (first)
    this.hono.use("*", createRequestIDMiddleware());

    // Logger middleware
    this.hono.use("*", createLoggerMiddleware(this.logger));

    // CORS middleware
    this.hono.use("*", createCorsMiddleware(this.config.cors));

    // Rate limiting middleware
    this.hono.use("*", createRateLimitMiddleware(this.config.rate_limit));
  }

  private setupDependencies() {
    // User domain
    const userRepo = new UserRepository(this.db, this.logger);
    const passworder = new Passworder(this.config.argon2id);
    const userUseCase = new UserUseCase(
      userRepo,
      this.config.jwt,
      passworder,
      this.logger,
    );
    const userHandler = new UserHandler(userUseCase, this.logger);

    // Task domain
    const taskRepo = new TaskRepository(this.db, this.logger);
    const taskUseCase = new TaskUseCase(taskRepo, this.logger);
    const taskHandler = new TaskHandler(taskUseCase, this.logger);

    // Register routes
    this.registerUserRoutes(userHandler);
    this.registerTaskRoutes(taskHandler);
  }

  private setupRoutes() {
    // Health check endpoints
    this.hono.get("/health", (c) => {
      return success(c, {
        status: "healthy",
        timestamp: new Date().toISOString(),
      });
    });

    this.hono.get("/readiness", async (c) => {
      const isHealthy = await this.db.healthCheck();
      if (isHealthy) {
        return success(c, { status: "ready" });
      }
      return c.json({ status: "error", message: "Database not ready" }, 503);
    });
  }

  private registerUserRoutes(handler: UserHandler) {
    // Public routes
    this.hono.post("/api/v1/auth/register", (c) => handler.register(c));
    this.hono.post("/api/v1/auth/login", (c) => handler.login(c));

    // Protected routes
    const protectedRoutes = this.hono.basePath("/api/v1");
    protectedRoutes.use("*", createAuthMiddleware(this.config.jwt));

    protectedRoutes.get("/users/profile", (c) => handler.getProfile(c));
    protectedRoutes.put("/users/profile", (c) => handler.updateProfile(c));
    protectedRoutes.delete("/users/profile", (c) => handler.deleteAccount(c));
    protectedRoutes.get("/users", (c) => handler.listUsers(c));
  }

  private registerTaskRoutes(handler: TaskHandler) {
    // All task routes are protected
    const protectedRoutes = this.hono.basePath("/api/v1");
    protectedRoutes.use("/tasks*", createAuthMiddleware(this.config.jwt));

    protectedRoutes.post("/tasks", (c) => handler.createTask(c));
    protectedRoutes.get("/tasks", (c) => handler.listTasks(c));
    protectedRoutes.get("/tasks/:id", (c) => handler.getTask(c));
    protectedRoutes.put("/tasks/:id", (c) => handler.updateTask(c));
    protectedRoutes.delete("/tasks/:id", (c) => handler.deleteTask(c));
  }

  async start(): Promise<void> {
    const address = `${this.config.server.host}:${this.config.server.port}`;

    this.logger.info("Starting server", {
      host: this.config.server.host,
      port: this.config.server.port,
      env: this.config.server.env,
    });

    this.server = serve({
      fetch: this.hono.fetch,
      port: this.config.server.port,
      hostname: this.config.server.host,
    });

    this.logger.info("Server started", { address });
  }

  async stop(): Promise<void> {
    this.logger.info("Shutting down server...");

    if (this.server) {
      this.server.close();
    }

    await this.db.close();

    this.logger.info("Server stopped");
  }

  getHono(): Hono {
    return this.hono;
  }
}
