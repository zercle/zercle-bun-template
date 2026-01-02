# Technical Standards & Guidelines

## Language & Runtime
- **TypeScript Version:** 5.x
- **Bun Version:** 1.0.0+
- **Module:** github.com/zercle/zercle-bun-template

## Core Dependencies

### Web Framework
- **Hono** - HTTP server framework
- **Hono middleware** - Request ID, logger, recovery, CORS

### Database
- **pg (node-postgres)** - PostgreSQL driver
- **Drizzle ORM** - Type-safe SQL query generation
- **Drizzle Kit** - Migration and schema management

### Authentication
- **jose** - JWT token generation and validation
- **argon2** - Password hashing

### Configuration
- **dotenv/config** - Configuration management
- **zod** - Configuration validation

### Logging
- **pino** - Structured, zero-allocation logging

### Validation
- **zod** - Request validation and schema validation

### Documentation
- **OpenAPI** - API documentation generation

### Testing
- **bun test** - Built-in testing framework
- **vi (Vitest)** - Mocking utilities
- **testcontainers** - Integration testing

## Coding Standards

### Naming Conventions
- **Files:** camelCase with .ts extension (e.g., `userHandler.ts`)
- **Packages/Directories:** lowercase (e.g., `handler`, `usecase`)
- **Interfaces:** PascalCase with 'I' prefix (e.g., `IUserRepository`)
- **Classes:** PascalCase (e.g., `UserUseCase`, `UserHandler`)
- **Constants:** UPPER_SNAKE_CASE
- **Private variables:** camelCase with underscore prefix (e.g., `_privateVar`)
- **Public variables:** camelCase

### Code Organization
- **Directory structure:** One responsibility per directory
- **File size:** Keep files focused and under 300 lines when possible
- **Function length:** Prefer functions under 50 lines
- **Exported functions:** Must have JSDoc comments
- **Error handling:** Always handle errors, never ignore

### TypeScript Specifics
- **Strict mode enabled:** All TypeScript strict checks
- **Explicit types:** Avoid `any` type, use `unknown` for truly unknown data
- **Interfaces vs Types:** Use interfaces for object shapes, types for unions/intersections
- **Enums:** Prefer string enums or const assertions
- **Async/await:** Prefer over Promises for readability

### Design Patterns

**Repository Pattern:**
- Abstract data access behind interfaces
- Domain entities mapped to database models
- Repository implementations in infrastructure layer

**Use Case Pattern:**
- Business logic encapsulated in use cases
- Coordinate between repositories and handlers
- Domain-specific error definitions

**Factory Pattern:**
- Database factory for creating connections
- Configuration-based instantiation

**Middleware Pattern:**
- Request/response processing pipeline
- Cross-cutting concerns (auth, logging, CORS)

### SOLID Principles

**Single Responsibility:**
- Each module has one clear purpose
- Functions do one thing well
- Classes/interfaces focused on single capability

**Open/Closed:**
- Interfaces for extensibility
- New features through new implementations
- Avoid modifying existing, stable code

**Liskov Substitution:**
- Interface contracts honored by implementations
- Mock implementations behave like real ones

**Interface Segregation:**
- Small, focused interfaces
- Clients depend only on needed methods

**Dependency Inversion:**
- Depend on abstractions (interfaces)
- High-level modules don't depend on low-level
- Inversion of Control through DI

## Testing Guidelines

### Test Structure
- **Unit tests:** Test individual functions/methods
- **Integration tests:** Test component interactions
- **Table-driven tests:** Multiple test cases in one function
- **Mock tests:** Use generated mocks for dependencies

### Test Organization
```
src/
  domain/
    user/
      handler/
        handler.ts
        handler.test.ts
      usecase/
        usecase.ts
        usecase.test.ts
test/
  integration/
    api.test.ts
  mock/
    dbMock.test.ts
```

### Testing Best Practices
- Write tests for critical business logic
- Aim for >80% coverage on core paths
- Use table-driven tests for multiple scenarios
- Mock external dependencies (database, HTTP clients)
- Use testcontainers for real database integration tests
- Test error paths, not just happy paths

### Test Naming
- `describe('<FunctionName>_<Scenario>_<ExpectedResult>')`
- `it('should <expected behavior>')`
- Example: `describe('Login_ValidCredentials_ReturnsToken')`

## Security Standards

### Password Storage
- Always use Argon2 for password hashing
- Configurable memory, iterations, parallelism
- Never store plaintext passwords

### Authentication
- JWT tokens for stateless authentication
- Token expiration configurable
- Secret key must be environment-specific
- Validate tokens on protected routes

### Input Validation
- Validate all user inputs
- Use Zod schemas for request DTOs
- Sanitize database queries (Drizzle prevents SQL injection)
- Validate file uploads (size, type)

### CORS Configuration
- Whitelist allowed origins per environment
- Configure allowed methods and headers
- Use secure defaults for production

### Rate Limiting
- Configurable requests per time window
- Apply to API endpoints
- Prevent abuse and DoS attacks

## Database Standards

### Migrations
- Use Drizzle Kit migration format
- Up and down migrations required
- Version with timestamp format
- Place in `src/drizzle/migrations/` directory

### Queries
- Use Drizzle ORM for type-safe queries
- Schema definitions in `src/drizzle/schema/`
- Named queries for clarity
- Parameterized queries (Drizzle handles this)

### Connection Pooling
- Configure min/max connections
- Set connection lifetime and idle timeout
- Health check period for stale connections
- Adjust based on application load

## Error Handling

### Error Types
- **Domain errors:** Business rule violations (e.g., `ErrUserNotFound`)
- **Repository errors:** Data access failures
- **Infrastructure errors:** External service failures
- **Validation errors:** Input validation failures

### Error Wrapping
- Wrap errors with context using custom error classes
- Use `instanceof` for error checking
- Log errors with sufficient context
- Return appropriate HTTP status codes

### HTTP Status Codes
- 200 OK - Successful GET/PUT/PATCH
- 201 Created - Successful POST
- 400 Bad Request - Validation errors
- 401 Unauthorized - Missing/invalid JWT
- 404 Not Found - Resource not found
- 409 Conflict - Duplicate resources
- 500 Internal Server Error - Unexpected errors

## Logging Standards

### Log Levels
- **Debug:** Detailed diagnostic information
- **Info:** General informational messages
- **Warn:** Warning messages for potential issues
- **Error:** Error events that might still allow continued operation
- **Fatal:** Severe errors requiring immediate attention

### Log Format
- Structured JSON logging
- Include request ID for tracing
- Contextual fields (user_id, action, resource)
- Timestamps in ISO 8601 format

### What to Log
- Application startup/shutdown
- Request/response for API calls (with request ID)
- Errors with stack traces
- Business events (user registration, task creation)
- Performance metrics (slow queries, long-running operations)

## API Standards

### RESTful Design
- Use appropriate HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Resource-based URLs (e.g., `/api/v1/users/:id`)
- Query parameters for filtering and pagination
- Consistent response format

### Response Format
```json
{
  "data": { ... },
  "error": null,
  "meta": { "total": 100, "page": 1 }
}
```

### Versioning
- URL-based versioning: `/api/v1/`
- Backward compatibility within major versions
- Deprecation notices for breaking changes

### Documentation
- OpenAPI/Swagger documentation
- Auto-generated from code annotations
- Example requests/responses
- Authentication requirements documented

## Deployment Guidelines

### Docker
- Multi-stage builds for optimization
- Alpine-based images for smaller size
- Non-root user for security
- Health checks defined in Dockerfile

### Configuration
- Environment-specific configs (local, dev, uat, prod)
- Sensitive data via environment variables
- Never commit secrets to repository

### Health Checks
- `/health` - Application health
- `/readiness` - Readiness for traffic
- Database connectivity check
- Dependency service checks

## Performance Guidelines

### Database
- Use connection pooling
- Optimize queries with proper indexes
- Batch operations when possible
- Use prepared statements (Drizzle handles this)

### HTTP
- Enable compression for large responses
- Use appropriate cache headers
- Implement rate limiting
- Monitor response times

### Memory
- Reuse objects where possible
- Avoid allocations in hot paths
- Use value types for small structs
- Profile before optimizing

## Code Quality

### Linting
- Use ESLint with TypeScript support
- Configure in `.eslintrc.json`
- Run in CI/CD pipeline

### Formatting
- Use Prettier for consistent formatting
- Configure in `.prettierrc`
- Auto-format on save

### Code Review Checklist
- Follows coding standards
- Tests included and passing
- Error handling complete
- Documentation updated
- No security vulnerabilities
- Performance considered

### Documentation
- JSDoc comments for exported functions
- README with setup instructions
- API documentation (OpenAPI)
- Architecture documentation (Memory Bank)

## TypeScript Best Practices

### Type Safety
- Enable strict mode in tsconfig.json
- Use explicit return types for functions
- Avoid `any` type
- Use `unknown` for truly unknown data
- Leverage type inference where appropriate

### Async Patterns
- Use async/await over Promises
- Handle errors with try/catch
- Use Promise.all for parallel operations
- Consider AbortController for cancellation

### Module System
- Use ES modules (import/export)
- Avoid default exports
- Use named exports for better tree-shaking
- Keep barrel files (index.ts) for clean imports

### Error Handling
- Create custom error classes
- Use error codes for internationalization
- Include context in error messages
- Don't expose sensitive data in errors

## Bun Specific Guidelines

### Performance
- Leverage Bun's fast startup time
- Use Bun's built-in test runner
- Take advantage of Bun's native APIs
- Use Bun's file system API for I/O

### Compatibility
- Ensure Node.js compatibility when needed
- Use Bun's polyfills for web APIs
- Test in both Bun and Node.js environments
- Be aware of Bun-specific APIs

### Development
- Use `bun run` for scripts
- Use `bun install` for dependencies
- Use `bun test` for testing
- Use `bun build` for production builds
