# Context & Decisions

## Architectural Decisions

### Clean Architecture Choice

**Decision:** Adopted Clean Architecture with DDD principles
**Rationale:** Separates business logic from infrastructure, improves testability, enables independent evolution of layers
**Impact:** All new domains must follow the established layer structure

### Drizzle ORM for Database Access

**Decision:** Use Drizzle ORM instead of raw SQL or other ORMs
**Rationale:** Type-safe queries, excellent TypeScript support, better performance than heavy ORMs, explicit SQL control when needed
**Impact:** All database queries use Drizzle ORM, schema definitions in `src/drizzle/schema/`

### JWT Stateless Authentication

**Decision:** JWT tokens without server-side session storage
**Rationale:** Stateless design enables horizontal scaling, simpler architecture, no session management overhead
**Impact:** All protected routes require JWT middleware, tokens stored client-side

### Argon2id for Password Hashing

**Decision:** Argon2id algorithm for password hashing
**Rationale:** Memory-hard, resistant to GPU/ASIC attacks, recommended by security experts
**Impact:** All password operations must use the password.Hasher wrapper

### Hono Framework

**Decision:** Hono as HTTP framework
**Rationale:** High performance, minimal boilerplate, excellent middleware support, Edge runtime compatible, active TypeScript community
**Impact:** All HTTP handlers use Hono context and patterns

## Domain Rules

### User Domain

**Business Rules:**

- Email must be unique across all users
- Password must be hashed before storage
- Users can only update their own profiles
- Email cannot be changed after registration
- Minimum full name length: 2 characters

**Validation Rules:**

- Email format validated by Zod schemas
- Password strength enforced by Argon2id parameters
- Phone number is optional
- Full name required for registration

**Ownership Rules:**

- Users can only access their own profile
- Admin endpoints (if added) can access all users
- User ID extracted from JWT token for authorization

### Task Domain

**Business Rules:**

- Tasks must have an owner (user_id)
- Users can only access their own tasks
- Task status must be one of: pending, in_progress, completed, cancelled
- Task priority must be one of: low, medium, high, urgent
- Completed tasks automatically set completed_at timestamp

**Validation Rules:**

- Title is required
- Description is optional
- Due date is optional
- Status defaults to "pending"
- Priority defaults to "medium" if not specified

**Ownership Rules:**

- All task operations verify user ownership
- Cannot access/modify tasks owned by other users
- Task list filtered by user_id

## File & Component Summaries

### Core Application Files

**src/index.ts**

- Application entry point
- Loads environment-specific configuration
- Initializes logger and application
- Handles graceful shutdown

**src/app/app.ts**

- Main application structure
- Dependency injection container
- Middleware setup (RequestID, Logger, Recovery, CORS, RateLimit)
- Route registration
- Server lifecycle management

### Configuration

**src/infrastructure/config/config.ts**

- Configuration structs for all components
- dotenv/config-based configuration loading
- Environment variable support
- Type-safe configuration access with Zod schemas

**.env.example**

- Environment-specific configurations
- local, dev, uat, prod environments
- Database, JWT, logging, CORS, rate limit settings

### Database Layer

**src/infrastructure/db/postgres.ts**

- PostgreSQL database implementation
- Connection pooling configuration
- Health check implementation
- Drizzle ORM integration

**src/infrastructure/db/factory.ts**

- Database factory for creating connections
- Abstracts database type selection
- Currently supports PostgreSQL only

**src/drizzle/schema/**

- Drizzle schema definitions
- Type-safe database models
- Table definitions and relationships

**src/drizzle/migrations/**

- Database migration files
- Up and down migrations
- Versioned schema changes

### Domain: User

**src/domain/user/entity/user.ts**

- User entity definition
- UUID-based primary key
- Fields: id, email, password, full_name, phone, timestamps

**src/domain/user/repository/repository.ts**

- Drizzle-based repository implementation
- CRUD operations for users
- Email uniqueness check
- Pagination support

**src/domain/user/usecase/usecase.ts**

- Business logic for user operations
- Register, Login, GetProfile, UpdateProfile, DeleteAccount, ListUsers
- Password hashing and verification
- JWT token generation
- Domain-specific error definitions

**src/domain/user/handler/handler.ts**

- HTTP handlers for user endpoints
- Request/response DTO mapping
- Error handling and HTTP status codes
- Route registration

### Domain: Task

**src/domain/task/entity/task.ts**

- Task entity definition
- UUID-based primary key
- Fields: id, user_id, title, description, status, priority, due_date, completed_at, timestamps

**src/domain/task/repository/repository.ts**

- Drizzle-based repository implementation
- CRUD operations for tasks
- User filtering for list operations
- Ownership verification

**src/domain/task/usecase/usecase.ts**

- Business logic for task operations
- CreateTask, GetTask, ListTasks, UpdateTask, DeleteTask
- Status and priority validation
- Ownership enforcement
- Domain-specific error definitions

**src/domain/task/handler/handler.ts**

- HTTP handlers for task endpoints
- Request/response DTO mapping
- Error handling and HTTP status codes
- Protected routes only

### Infrastructure Components

**src/infrastructure/logger/logger.ts**

- Pino-based structured logger
- Configurable log levels and format
- Request ID integration
- Context-aware logging

**src/infrastructure/password/passworder.ts**

- Argon2id password hashing wrapper
- Configurable parameters
- Hash and verify operations

**src/infrastructure/http/client/httpClient.ts**

- HTTP client wrapper (using fetch)
- For making external HTTP requests
- Configurable timeouts and retries

**src/middleware/**

- Custom middleware implementations
- JWT authentication
- Request ID generation
- Structured logging
- CORS handling
- Rate limiting

**src/health/**

- Health check handler
- Database connectivity check
- Readiness probe

## Dependency Mapping

### Domain Dependencies

- **User Domain:** Depends on config, logger, password, middleware (JWT)
- **Task Domain:** Depends on logger only (uses Drizzle directly for DB)

### Infrastructure Dependencies

- **Database:** pg (node-postgres) driver
- **Config:** dotenv/config
- **Logging:** pino
- **Validation:** zod
- **Auth:** jose or similar JWT library
- **Password:** argon2 or similar

### External Dependencies

- **PostgreSQL:** Primary database
- **Testcontainers:** Integration testing (via bun test)
- **OpenAPI:** API documentation

## Key Implementation Details

### JWT Token Structure

- Contains user ID and email in claims
- Configurable expiration time
- Secret key from configuration
- Bearer token format in Authorization header

### Database Connection Pool

- Min connections: 5
- Max connections: 25
- Connection lifetime: 1 hour
- Idle timeout: 10 minutes
- Health check period: 1 minute

### Rate Limiting

- Configurable requests per time window
- Default: 100 requests per 60 seconds
- Applied at middleware level
- Per-client tracking

### CORS Configuration

- Allowed origins configurable per environment
- Local: localhost:3000, localhost:8080
- Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
- Headers: Authorization, Content-Type, X-Request-ID

### Error Handling Pattern

```typescript
// UseCase layer: Domain errors
if (!user) {
  return ErrUserNotFound;
}

// Repository layer: Wrap with context
if (err) {
  throw new Error(`Failed to create user: ${err.message}`);
}

// Handler layer: Map to HTTP status
if (err instanceof ErrUserNotFound) {
  return c.json({ error: "User not found" }, 404);
}
```

### Request Validation

- Use Zod schemas for validation
- Validate before business logic
- Return validation errors with field details
- Example: `z.string().email()`

### Pagination Pattern

```typescript
// Standard pagination parameters
const { limit, offset } = getPaginationParams(c);

// Repository returns data + total count
const { users, total } = await repo.list(ctx, limit, offset);

// Response includes pagination metadata
return c.json({
  users,
  total,
  limit,
  offset,
});
```

## Testing Strategy

### Unit Tests

- Test usecase business logic
- Mock repository dependencies
- Test error paths and edge cases
- Located in same directory as implementation with `.test.ts` suffix

### Integration Tests

- Test API endpoints end-to-end
- Use testcontainers for real database
- Test authentication flow
- Located in test/integration/

### Mock Generation

- Use vi (Vitest) for mocking
- Generate mocks from domain interfaces
- Located in domain/\*/mock/ directories
- Regenerate when interfaces change

### Test Helpers

- test/mock/dbMock.ts - Database mock utilities
- test/integration/testHelper.ts - Integration test setup
- Common test fixtures and utilities

## Migration Strategy

### Database Migrations

- Drizzle Kit migration format
- Up and down migrations required
- Version naming: timestamp_description
- Apply migrations in order
- Rollback support with down migrations

### Schema Changes

- Add new migrations for schema changes
- Never modify existing migrations
- Use Drizzle to regenerate schema after changes
- Test migrations in all environments

## Configuration Management

### Environment Hierarchy

1. Base config from .env file
2. Environment variable overrides
3. Default values in Zod schemas

### Configuration Files

- `.env.example` - Example configuration
- `.env.local` - Local development (not committed)
- `.env.dev` - Development environment
- `.env.uat` - User acceptance testing
- `.env.prod` - Production

### Environment Variables

- `NODE_ENV` - Environment selector (default: local)
- Database credentials via env vars in production
- JWT secret via env vars in production
- Never commit secrets to repository

## Deployment Considerations

### Docker Deployment

- Multi-stage build for optimization
- Alpine-based final image
- Non-root user for security
- Health checks configured
- Port 3000 exposed

### Database Requirements

- PostgreSQL 12+ required
- Connection pool configuration important
- Migrations must be applied before startup
- Health check verifies connectivity

### Monitoring Points

- Health check endpoints
- Request/response logging
- Error logging with context
- Performance metrics (future)
- Database query performance (future)

## Known Constraints

### Current Limitations

- Only PostgreSQL supported (no MySQL, SQLite)
- No caching layer implemented
- No message queue integration
- No distributed tracing
- No metrics collection
- Single-region deployment only

### Technical Debt

- Consider adding caching layer
- Consider standardizing database access patterns
- Evaluate alternative ORM options

### Future Considerations

- Add Redis caching layer
- Implement message queue for async operations
- Add Prometheus metrics
- Implement distributed tracing with OpenTelemetry
- Add GraphQL support as alternative to REST
- Consider gRPC for internal service communication
