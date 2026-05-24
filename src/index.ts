/**
 * Main entry point for the Bun + Hono.js API server.
 * Initializes configuration, database, services, and starts the HTTP server.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { loadConfig, serverAddr } from './config/config';
import { AuthHandler } from './internal/features/auth/handler/http/auth.handler';
import { AuthService } from './internal/features/auth/service/auth.service';
import type { AuthServiceInterface } from './internal/features/auth/service/interface';
import { ChatHandler } from './internal/features/chat/handler/http/chat.handler';
import { ChatService } from './internal/features/chat/service/chat.service';
import type { ChatServiceInterface } from './internal/features/chat/service/interface';
import { createDB } from './internal/infrastructure/db/drizzle/connection';
import { DrizzleMessageRepository } from './internal/infrastructure/db/drizzle/message.repository';
import { DrizzleRoomRepository } from './internal/infrastructure/db/drizzle/room.repository';
import { DrizzleSessionRepository } from './internal/infrastructure/db/drizzle/session.repository';
import { DrizzleUserRepository } from './internal/infrastructure/db/drizzle/user.repository';
import { authMiddleware } from './internal/shared/middleware/auth.middleware';
import { errorMiddleware } from './internal/shared/middleware/error.middleware';
import { loggingMiddleware } from './internal/shared/middleware/logging.middleware';
import { requestIdMiddleware } from './internal/shared/middleware/request-id.middleware';
import { createLogger } from './internal/shared/telemetry/logger';

async function main(): Promise<void> {
  // 1. Load configuration
  const cfg = loadConfig();

  // 2. Create logger
  const logger = createLogger(cfg.logLevel, cfg.logFormat);

  logger.info('starting application', { environment: cfg.appEnvironment });

  // 3. Initialize database
  const db = await createDB(cfg, logger);

  // 4. Create repositories
  const userRepo = new DrizzleUserRepository(db);
  const sessionRepo = new DrizzleSessionRepository(db);
  const roomRepo = new DrizzleRoomRepository(db);
  const messageRepo = new DrizzleMessageRepository(db);

  // 5. Create services
  const authService: AuthServiceInterface = new AuthService(
    userRepo,
    sessionRepo,
    cfg.authAccessTokenSecret,
    cfg.authAccessTokenTtl,
    cfg.authRefreshTokenTtl,
    logger.child({ component: 'auth' }),
  );

  const chatService: ChatServiceInterface = new ChatService(
    roomRepo,
    messageRepo,
    null,
    logger.child({ component: 'chat' }),
  );

  // 6. Create handlers
  const authHandler = new AuthHandler(authService);
  const chatHandler = new ChatHandler(
    chatService,
    logger.child({ component: 'chat-handler' }),
  );

  // 7. Build Hono app
  const app = new Hono();

  // Global middleware
  app.use('*', cors());
  app.use(requestIdMiddleware);
  app.use(loggingMiddleware(logger));
  app.use(errorMiddleware(logger));

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok' }));

  // API v1 routes
  const v1 = new Hono();

  // Auth routes (public + protected)
  authHandler.registerRoutes(v1);

  // Chat routes (all protected by auth)
  const chat = new Hono();
  chat.use(
    authMiddleware(authService, logger.child({ component: 'auth-middleware' })),
  );
  chatHandler.registerRoutes(chat);
  v1.route('/chat', chat);

  // Mount API routes
  app.route('/api/v1', v1);

  // 404 handler
  app.notFound((c) =>
    c.json(
      { error: { code: 'NOT_FOUND', message: 'Resource not found' } },
      404,
    ),
  );

  // 8. Start server
  const addr = serverAddr(cfg);
  const server = Bun.serve({
    fetch: app.fetch,
    port: cfg.serverPort,
    hostname: cfg.serverHost,
  });

  logger.info('server listening', { address: addr });

  // 9. Graceful shutdown
  const shutdown = async () => {
    logger.info('shutting down server');
    server.stop();
    await db.close();
    logger.info('server stopped');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Keep alive
  await new Promise(() => {});
}

main().catch((err) => {
  console.error('fatal error:', err);
  process.exit(1);
});
