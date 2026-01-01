# Zercle Bun Template

A production-ready RESTful API template built with Bun runtime and Hono framework, featuring clean architecture, JWT authentication, and PostgreSQL database. This template provides a solid foundation for building Bun microservices or REST APIs with best practices already implemented.

## Features

- **Clean Architecture** - Domain-driven design with clear separation of concerns
- **Type-safe Database Operations** - Drizzle ORM for type-safe database queries
- **JWT Authentication** - Stateless authentication with configurable expiration
- **Password Security** - Argon2id hashing for secure password storage
- **Comprehensive Testing** - Unit, integration, and mock testing infrastructure
- **API Documentation** - Swagger/OpenAPI documentation out of the box
- **Structured Logging** - Pino for high-performance JSON logging
- **Docker Support** - Containerized deployment with Docker Compose
- **Rate Limiting** - Configurable request rate limiting
- **CORS Support** - Configurable cross-origin resource sharing
- **Health Checks** - Application and readiness endpoints

## Tech Stack

- **Language**: TypeScript 5.x
- **Runtime**: Bun 1.0.0+
- **Web Framework**: Hono
- **Database**: PostgreSQL 12+ with pg (node-postgres)
- **ORM/Query Builder**: Drizzle ORM
- **Authentication**: JWT (jose)
- **Password Hashing**: Argon2id (argon2 npm package)
- **Configuration**: dotenv/config
- **Logging**: Pino
- **Validation**: Zod
- **Documentation**: OpenAPI tools for TypeScript
- **Testing**: bun test, vi, testcontainers-node

## Project Structure

```
.
├── src/
│   ├── index.ts                 # Application entry point
│   ├── app/
│   │   └── app.ts               # Application orchestration & DI
│   ├── domain/
│   │   ├── user/                # User domain (example)
│   │   │   ├── entity/          # Business entities
│   │   │   ├── handler/         # HTTP handlers
│   │   │   ├── repository/      # Data access layer
│   │   │   ├── usecase/         # Business logic
│   │   │   ├── request/         # Request DTOs
│   │   │   ├── response/        # Response DTOs
│   │   │   ├── mock/            # Mock implementations
│   │   │   └── interface.ts     # Domain interfaces
│   │   └── task/                # Task domain (example)
│   └── infrastructure/
│       ├── config/              # Configuration management
│       ├── db/                  # Database abstraction
│       ├── http/                # HTTP client
│       ├── logger/              # Structured logging
│       └── password/            # Password hashing
├── drizzle/
│   ├── migrations/              # Database migrations
│   └── schema.ts                # Drizzle schema definitions
├── configs/
│   ├── local.yaml               # Local development config
│   ├── dev.yaml                 # Development config
│   ├── uat.yaml                 # UAT config
│   └── prod.yaml                # Production config
├── test/
│   ├── integration/             # Integration tests
│   └── mock/                    # Mock utilities
├── scripts/
│   ├── run-dev.sh               # Development runner
│   └── seed-db.sh               # Database seeding
├── deployments/
│   └── docker/
│       ├── Dockerfile           # Docker image
│       └── docker-compose.yml   # Docker Compose setup
├── docs/                        # OpenAPI documentation
├── .env.example                 # Environment variables template
├── package.json                 # Dependencies and scripts
├── tsconfig.json                # TypeScript configuration
├── drizzle.config.ts            # Drizzle ORM configuration
├── bun.lockb                    # Bun lockfile
└── eslint.config.js             # ESLint configuration
```

## Architecture

This template follows **Clean Architecture** with **Domain-Driven Design (DDD)** principles:

### Layers

1. **Domain Layer** (`src/domain/`) - Core business logic and entities, independent of infrastructure
2. **Infrastructure Layer** (`src/infrastructure/`) - External concerns and technical implementations
3. **Application Layer** (`src/app/`) - Application orchestration and dependency injection
4. **Entry Point** (`src/index.ts`) - Application bootstrap

### Data Flow

```
Client → Handler → UseCase → Repository → Database
         ↓         ↓          ↓
     Request   Business    Data Access
     DTO       Logic       Layer
```

## Getting Started

### Prerequisites

- Bun 1.0.0 or higher
- Node.js 18+ (for some development tools)
- PostgreSQL 12+
- Docker (optional, for containerized deployment)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/zercle/zercle-bun-template.git
cd zercle-bun-template
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Install dependencies:
```bash
bun install
```

4. Configure database connection in `.env` or `configs/local.yaml`

5. Run database migrations:
```bash
bunx drizzle-kit push
```

6. Generate Drizzle client:
```bash
bunx drizzle-kit generate
```

7. Generate OpenAPI documentation:
```bash
bun run docs:generate
```

### Running the Application

#### Development

```bash
# Set environment
export SERVER_ENV=local

# Run the application
bun run src/index.ts
```

Or use the provided script:
```bash
./scripts/run-dev.sh
```

#### Production

```bash
# Build the application
bun build src/index.ts --outdir ./dist

# Run the built application
bun run dist/index.js
```

#### Docker

```bash
# Build Docker image
docker build -t zercle-bun-template .

# Run container
docker run -p 3000:3000 \
  -e SERVER_ENV=prod \
  -e DATABASE_URL=postgres://user:pass@host:5432/dbname \
  zercle-bun-template
```

#### Docker Compose

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

## Configuration

Configuration is managed through YAML files in the `configs/` directory:

- `local.yaml` - Local development
- `dev.yaml` - Development environment
- `uat.yaml` - User acceptance testing
- `prod.yaml` - Production

Environment variables can override configuration values. Set `SERVER_ENV` to select the configuration file.

### Key Configuration Sections

- **Database**: Connection string, pool settings
- **JWT**: Secret key, expiration time
- **Server**: Port, timeout settings
- **Logging**: Level, format, output
- **CORS**: Allowed origins, methods, headers
- **Rate Limiting**: Requests per window, window duration

## API Documentation

Once the application is running, access the Swagger documentation at:

```
http://localhost:3000/swagger/index.html
```

### Available Endpoints

#### Health Checks
- `GET /health` - Application health check
- `GET /readiness` - Readiness probe

#### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login

#### User Management
- `GET /api/v1/users` - List users (paginated)
- `GET /api/v1/users/:id` - Get user profile
- `PUT /api/v1/users/:id` - Update user profile (protected)
- `DELETE /api/v1/users/:id` - Delete account (protected)

#### Task Management (Example Domain)
- `POST /api/v1/tasks` - Create task (protected)
- `GET /api/v1/tasks` - List tasks (protected, paginated)
- `GET /api/v1/tasks/:id` - Get task (protected)
- `PUT /api/v1/tasks/:id` - Update task (protected)
- `DELETE /api/v1/tasks/:id` - Delete task (protected)

## Testing

### Run All Tests

```bash
bun test
```

### Run Tests with Coverage

```bash
bun test --coverage
```

### Generate Coverage Report

```bash
bun test --coverage
```

### Run Integration Tests

```bash
bun test test/integration/*.test.ts
```

### Run Specific Test

```bash
bun test test/unit/user/usecase.test.ts -t "TestLogin"
```

## Development Guidelines

### Adding a New Domain

1. Create domain structure under `src/domain/<domain>/`
2. Define entity in `entity/` directory
3. Create interfaces in `interface.ts`
4. Implement repository, usecase, and handler
5. Add request/response DTOs
6. Write tests
7. Wire dependencies in `src/app/app.ts`
8. Register routes
9. Update OpenAPI documentation

### Code Style

- Follow TypeScript standard formatting
- Use ESLint and Prettier for linting
- Write JSDoc comments for exported functions
- Keep functions under 50 lines when possible
- Follow SOLID principles

### Testing Standards

- Write unit tests for business logic
- Use table-driven tests for multiple scenarios
- Mock external dependencies with vi
- Aim for >80% coverage on critical paths
- Test error paths, not just happy paths

### Database Migrations

1. Create migration files in `drizzle/migrations/`
2. Format: `YYYYMMDD_NNN_description`
3. Write both up and down migrations
4. Apply migrations with Drizzle Kit
5. Regenerate Drizzle client: `bunx drizzle-kit generate`

## Common Commands

### Linting

```bash
# Run linter
bunx eslint .

# Fix issues automatically
bunx eslint . --fix
```

### Formatting

```bash
# Format code
bunx prettier --write .

# Check for issues
bunx prettier --check .
```

### Dependencies

```bash
# Install dependencies
bun install

# Add a dependency
bun add <package-name>

# Add a dev dependency
bun add -d <package-name>

# Update dependencies
bun update
```

### Drizzle Kit

```bash
# Generate Drizzle client
bunx drizzle-kit generate

# Push schema changes to database
bunx drizzle-kit push

# Open Drizzle Studio
bunx drizzle-kit studio
```

### Documentation

```bash
# Generate OpenAPI docs
bun run docs:generate
```

## Environment Variables

Key environment variables (see `.env.example`):

- `SERVER_ENV` - Environment (local, dev, uat, prod)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `JWT_EXPIRATION` - Token expiration time
- `SERVER_PORT` - Server port (default: 3000)

## Security

- Passwords hashed with Argon2id
- JWT tokens for stateless authentication
- Input validation with Zod on all endpoints
- CORS configuration per environment
- Rate limiting to prevent abuse
- SQL injection prevention via Drizzle ORM

## Performance

- Database connection pooling
- Efficient query generation via Drizzle ORM
- Structured logging with minimal overhead
- Graceful shutdown handling
- Configurable timeouts

## Deployment

### Production Checklist

- [ ] Set strong JWT secret
- [ ] Configure production database
- [ ] Enable HTTPS/TLS
- [ ] Set appropriate CORS origins
- [ ] Configure rate limiting
- [ ] Set log level to INFO or WARN
- [ ] Enable health checks
- [ ] Configure monitoring and alerting
- [ ] Run database migrations
- [ ] Test all endpoints

### Docker Deployment

The provided Dockerfile uses a multi-stage build for optimization:

- Builder stage: Installs dependencies and builds the Bun application
- Runtime stage: Minimal Bun-based image
- Non-root user for security
- Health checks configured

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Pull Request Guidelines

- Follow existing code style
- Add tests for new features
- Update documentation
- Ensure all tests pass
- Run linter and fix issues

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## Support

For issues, questions, or contributions, please visit the GitHub repository.

## Roadmap

Future enhancements planned:

- [ ] Redis caching layer
- [ ] Message queue integration (RabbitMQ/Kafka)
- [ ] Metrics collection (Prometheus)
- [ ] Distributed tracing (OpenTelemetry)
- [ ] API versioning strategy
- [ ] GraphQL support option
- [ ] Additional example domains

## Acknowledgments

Built with best practices and modern Bun and TypeScript development tools. Special thanks to the open-source community for the excellent libraries and frameworks used in this project.
