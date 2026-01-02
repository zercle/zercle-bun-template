# Operational Workflows

## Test-Driven Development (TDD)

### TDD Cycle

1. **Red:** Write a failing test for the desired behavior
2. **Green:** Write minimal code to make the test pass
3. **Refactor:** Improve code while keeping tests green

### When to Write Tests

- **Before implementing:** New features or business logic
- **Before fixing bugs:** Reproduce the bug with a test
- **After refactoring:** Ensure behavior unchanged
- **Critical paths:** Authentication, authorization, data persistence

### Test Organization

**Unit Tests:**

- Location: Same directory as implementation (`.test.ts` suffix)
- Scope: Single function or method
- Dependencies: Mock external dependencies
- Examples: `src/domain/user/usecase/usecase.test.ts`

**Integration Tests:**

- Location: `test/integration/`
- Scope: End-to-end API flows
- Dependencies: Real database (testcontainers)
- Examples: `test/integration/api.test.ts`

**Mock Tests:**

- Location: `test/mock/`
- Scope: Database interactions
- Dependencies: Database mocks
- Examples: `test/mock/dbMock.test.ts`

### Test Structure Template

```typescript
describe("<FunctionName>_<Scenario>_<ExpectedResult>", () => {
  it("should return expected result", async () => {
    // Arrange
    const mockRepo = vi.mocked(createMockUserRepository());
    const useCase = new UserUseCase(mockRepo, cfg, argon2Cfg, log);

    // Setup expectations
    mockRepo.getByEmail.mockResolvedValue(null);

    // Act
    const result = await useCase.register(ctx, request);

    // Assert
    expect(result).toBeDefined();
    expect(result.token).not.toBeEmpty();
  });
});
```

### Table-Driven Tests

```typescript
describe("validateEmail", () => {
  const testCases = [
    { name: "valid email", email: "user@example.com", wantErr: false },
    { name: "invalid format", email: "invalid", wantErr: true },
    { name: "empty", email: "", wantErr: true },
  ];

  testCases.forEach(({ name, email, wantErr }) => {
    it(name, () => {
      const err = validateEmail(email);
      expect(!!err).toBe(wantErr);
    });
  });
});
```

### Running Tests

**All tests:**

```bash
bun test
```

**Specific file:**

```bash
bun test src/domain/user/usecase/usecase.test.ts
```

**With coverage:**

```bash
bun test --coverage
```

**Integration tests:**

```bash
bun test test/integration/
```

### Test Coverage Goals

- **Critical business logic:** >90%
- **Domain use cases:** >80%
- **Handlers:** >70%
- **Infrastructure:** >60%
- **Overall:** >70%

## Refactoring Procedures

### When to Refactor

- Code duplication detected
- Complex functions (>50 lines)
- God objects with too many responsibilities
- Poor naming or unclear intent
- Performance bottlenecks identified
- Adding new features becomes difficult

### Refactoring Checklist

- [ ] Ensure tests exist and pass
- [ ] Identify the smell/problem
- [ ] Plan the refactoring approach
- [ ] Make small, incremental changes
- [ ] Run tests after each change
- [ ] Verify behavior unchanged
- [ ] Update documentation if needed
- [ ] Commit with clear message

### Common Refactorings

**Extract Method:**

- Move code to a new function
- Give it a descriptive name
- Replace original code with function call

**Extract Interface:**

- Identify common behavior
- Create interface with methods
- Implement interface in concrete types
- Update dependencies to use interface

**Replace Magic Numbers:**

- Identify constants in code
- Create named constants
- Replace numbers with constants
- Add documentation

**Simplify Conditional:**

- Use guard clauses
- Replace nested if-else with switch
- Extract complex conditions to named functions

**Remove Dead Code:**

- Identify unused code
- Remove or comment out
- Run tests to verify
- Commit removal

### Refactoring Example

**Before:**

```typescript
async register(c: Context) {
  const req = await c.req.json();
  if (!req.email || !req.password) {
    return c.json({ error: 'Invalid request' }, 400);
  }
  if (!this.validator.validate(req)) {
    return c.json({ error: 'Validation failed' }, 400);
  }
  // ... more code
}
```

**After:**

```typescript
async register(c: Context) {
  const req = await this.bindAndValidateRequest(c);
  if (req instanceof Error) {
    return this.errorResponse(c, 400, req);
  }
  // ... more code
}

private async bindAndValidateRequest(c: Context) {
  const req = await c.req.json();
  if (!req.email || !req.password) {
    return new Error('Invalid request');
  }
  if (!this.validator.validate(req)) {
    return new Error('Validation failed');
  }
  return req;
}
```

## Code Review Checklist

### General Review

- [ ] Code follows project coding standards
- [ ] Naming is clear and descriptive
- [ ] Functions are small and focused
- [ ] No code duplication
- [ ] Comments explain "why", not "what"
- [ ] No commented-out code left behind
- [ ] Proper error handling throughout
- [ ] Logging at appropriate levels

### Architecture Review

- [ ] Follows clean architecture principles
- [ ] Dependencies point inward
- [ ] Domain logic isolated from infrastructure
- [ ] Interfaces used for external dependencies
- [ ] No circular dependencies
- [ ] Proper separation of concerns

### Security Review

- [ ] Input validation on all user inputs
- [ ] SQL injection prevention (Drizzle handles this)
- [ ] Authentication/authorization enforced
- [ ] Sensitive data not logged
- [ ] Secrets not hardcoded
- [ ] CORS properly configured
- [ ] Rate limiting applied

### Performance Review

- [ ] No N+1 query problems
- [ ] Database queries optimized
- [ ] Connection pooling configured
- [ ] No unnecessary allocations
- [ ] Efficient data structures used
- [ ] Caching considered where appropriate

### Testing Review

- [ ] Tests added for new functionality
- [ ] Tests cover edge cases
- [ ] Tests are readable and maintainable
- [ ] Mocks used appropriately
- [ ] Test coverage adequate
- [ ] Integration tests included for API changes

### Documentation Review

- [ ] JSDoc comments on exported functions
- [ ] API documentation updated (OpenAPI)
- [ ] README updated if needed
- [ ] Architecture docs updated if major change
- [ ] Migration files documented

### Specific Domain Reviews

**User Domain:**

- [ ] Password hashing with Argon2id
- [ ] Email uniqueness enforced
- [ ] JWT token properly generated
- [ ] User ownership verified

**Task Domain:**

- [ ] Task ownership verified
- [ ] Status values validated
- [ ] Priority values validated
- [ ] Due date handling correct

**Database:**

- [ ] Migration files created
- [ ] Drizzle schema updated
- [ ] Indexes added if needed
- [ ] Foreign keys defined

## Debugging Protocols

### Debugging Workflow

1. **Reproduce the Issue**
   - Get exact steps to reproduce
   - Identify affected environment
   - Gather error messages and logs
   - Note request/response data

2. **Gather Information**
   - Check application logs
   - Review database state
   - Examine request/response
   - Check configuration values

3. **Formulate Hypothesis**
   - Based on symptoms
   - Consider recent changes
   - Review related code
   - Check known issues

4. **Test Hypothesis**
   - Add logging to verify
   - Write reproduction test
   - Use debugger if needed
   - Isolate the problem

5. **Implement Fix**
   - Write minimal fix
   - Add tests for fix
   - Verify fix works
   - Check for side effects

### Debugging Tools

**Logging:**

```typescript
logger.debug("Processing request", { userId, taskId });
logger.error("Failed to update task", { error: err, taskId });
```

**Structured Logging:**

- Include request ID in all logs
- Use consistent field names
- Log at appropriate levels
- Include context for errors

**Error Inspection:**

```typescript
if (err) {
  logger.error("Operation failed", {
    error: err.message,
    operation: "createUser",
    email: req.email,
  });
  // Use instanceof for error checking
}
```

**Database Debugging:**

```bash
# Connect to database
psql -h localhost -U postgres -d postgres

# Check recent queries
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;

# Check connection pool
SELECT * FROM pg_stat_activity;
```

**HTTP Debugging:**

```bash
# Check API endpoint
curl -X GET http://localhost:3000/health

# With authentication
curl -X GET http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer <token>"

# Verbose output
curl -v http://localhost:3000/api/v1/tasks
```

### Common Issues & Solutions

**Database Connection Issues:**

- Check database is running
- Verify connection string
- Check connection pool settings
- Review firewall rules

**Authentication Failures:**

- Verify JWT secret matches
- Check token expiration
- Validate token format
- Review middleware configuration

**Performance Issues:**

- Check database query performance
- Review connection pool settings
- Profile with Bun's built-in tools
- Check for N+1 queries

**Test Failures:**

- Run tests with verbose output
- Check test data setup
- Verify mock expectations
- Review test isolation

### Adding Debug Logging

**Before Production:**

```typescript
async login(ctx: Context, req: LoginUser) {
  logger.debug('Login attempt', { email: req.email });

  const userModel = await this.repo.getByEmail(ctx, req.email);
  if (!userModel) {
    logger.error('User not found', { email: req.email });
    throw ErrInvalidCredentials;
  }

  // ... rest of code
}
```

**Remove Before Production:**

- Remove debug-level logs
- Keep error and warn logs
- Ensure no sensitive data in logs

### Performance Debugging

**Enable Profiling:**

```typescript
// Bun has built-in profiling
// Add to routes
app.get("/debug/pprof/*", async (c) => {
  // Profiling endpoint
});
```

### Integration Testing Debugging

**Run Single Test:**

```bash
bun test test/integration/api.test.ts -t "Login"
```

**Keep Database Running:**

```bash
# Testcontainers handles cleanup automatically
```

**View Test Database:**

```bash
# Get container ID
docker ps

# Connect to test database
docker exec -it <container_id> psql -U postgres -d postgres
```

## Adding a New Domain

### Step-by-Step Process

1. **Create Domain Structure**

   ```
   src/domain/<domain>/
     entity/
     handler/
     repository/
     usecase/
     request/
     response/
     mock/
     interface.ts
   ```

2. **Define Entity**
   - Create entity in `entity/<domain>.ts`
   - Add UUID primary key
   - Add timestamps (created_at, updated_at)
   - Add business logic methods

3. **Create Interface**
   - Define Repository, Service, Handler interfaces
   - Follow existing patterns
   - Use domain-specific types

4. **Implement Repository**
   - Create Drizzle schema in `src/drizzle/schema/`
   - Run `bunx drizzle-kit generate` to create migrations
   - Implement repository interface
   - Handle errors appropriately

5. **Implement UseCase**
   - Create business logic
   - Define domain-specific errors
   - Implement validation rules
   - Add logging

6. **Implement Handler**
   - Create HTTP handlers
   - Map request/response DTOs
   - Handle errors
   - Register routes

7. **Add Tests**
   - Unit tests for usecase
   - Integration tests for API
   - Mock tests for repository

8. **Update Application**
   - Wire dependencies in `app.ts`
   - Register routes
   - Update OpenAPI documentation

9. **Update Documentation**
   - Add to architecture.md
   - Update context.md
   - Add API examples

## Database Migration Workflow

### Creating a Migration

1. **Create Migration File**

   ```bash
   # Drizzle Kit generates migrations
   bunx drizzle-kit generate
   ```

2. **Write Migration SQL**
   - Generated in `src/drizzle/migrations/`
   - Review and adjust if needed
   - Add indexes for foreign keys

3. **Apply Migration**

   ```bash
   bunx drizzle-kit migrate
   ```

4. **Generate Types**
   ```bash
   bunx drizzle-kit generate
   ```

### Migration Best Practices

- Always review generated migrations
- Use transactions for complex changes
- Add indexes for foreign keys
- Consider data migration for schema changes
- Test migrations on development first
- Never modify existing migrations

## Running the Application

### Development

```bash
# Set environment
export NODE_ENV=local

# Run with hot reload
bun run dev

# Or standard run
bun run src/index.ts
```

### Production

```bash
# Build
bun build src/index.ts --outdir ./dist

# Run
bun dist/index.js
```

### Docker

```bash
# Build image
docker build -t zercle-bun-template .

# Run container
docker run -p 3000:3000 \
  -e NODE_ENV=prod \
  -e DATABASE_URL=... \
  zercle-bun-template
```

### Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Common Commands

### Linting

```bash
# Run linter
bunx eslint .

# Fix issues
bunx eslint . --fix
```

### Formatting

```bash
# Format code
bunx prettier --write .

# Check formatting
bunx prettier --check .
```

### Dependencies

```bash
# Install dependencies
bun install

# Update dependencies
bun update

# Add dependency
bun add <package>

# Add dev dependency
bun add -d <package>
```

### Documentation

```bash
# Generate OpenAPI docs
bunx drizzle-kit studio

# View API docs
# Navigate to http://localhost:3000/docs
```

### Drizzle Kit

```bash
# Generate migrations
bunx drizzle-kit generate

# Apply migrations
bunx drizzle-kit migrate

# Open Drizzle Studio
bunx drizzle-kit studio
```

## Environment Setup

### Prerequisites

- Bun 1.0.0+
- PostgreSQL 12+
- Docker (optional, for containerized deployment)

### Local Development

1. Clone repository
2. Copy `.env.example` to `.env`
3. Configure database connection
4. Run migrations
5. Start application

### Database Setup

```bash
# Start PostgreSQL with Docker
docker run --name postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=postgres \
  -p 5432:5432 \
  -d postgres:15

# Run migrations
bunx drizzle-kit migrate
```

### Seed Data

```bash
# Run seed script
bun run scripts/seed-db.ts
```
