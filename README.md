# Zercle Bun Template

<div align="center">

![Bun](https://img.shields.io/badge/Bun-1.0.0-black?style=for-the-badge&logo=bun)
![Hono](https://img.shields.io/badge/Hono-4.6.0-red?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript)
![Drizzle ORM](https://img.shields.io/badge/Drizzle%20ORM-0.36.0-purple?style=for-the-badge)
![Docker](https://img.shields.io/badge/Docker-Ready-blue?style=for-the-badge&logo=docker)

A production-ready RESTful API template built with **Bun runtime** and **Hono framework**. This template implements domain-driven design (DDD) architecture with clean separation of concerns, making it ideal for building scalable, maintainable backend services.

[Features](#features) • [Tech Stack](#tech-stack) • [Project Structure](#project-structure) • [Quick Start](#quick-start) • [Documentation](#documentation)

</div>

---

## Features

- 🚀 **High Performance**: Built on Bun, the fastest JavaScript runtime
- 🎯 **Domain-Driven Design**: Clean architecture with separated domains, infrastructure, and utilities
- 🔐 **Secure Authentication**: JWT-based auth with Argon2id password hashing
- 📊 **Database Integration**: Drizzle ORM with PostgreSQL and type-safe migrations
- 🛡️ **Security Middleware**: CORS, rate limiting, request ID tracking, and JWT verification
- 📝 **TypeScript**: Full type safety with strict mode enabled
- 🐳 **Docker Ready**: Production-ready Docker configuration with docker-compose
- 📊 **Structured Logging**: Pino-based logging with configurable formats
- ✅ **API Response Format**: Consistent JSend-style response structure
- 🔧 **Configuration Management**: YAML-based config with environment variable overrides

## Tech Stack

| Category | Technology |
|----------|------------|
| Runtime | [Bun](https://bun.sh/) v1.0.0+ |
| Framework | [Hono](https://hono.dev/) v4.6.0 |
| Language | [TypeScript](https://www.typescriptlang.org/) v5.7 |
| Database | [PostgreSQL](https://www.postgresql.org/) with [Drizzle ORM](https://orm.drizzle.team/) v0.36.0 |
| Authentication | [JWT](https://jwt.io/) + [Argon2id](https://github.com/ranisalt/node-argon2) |
| Validation | [Zod](https://zod.dev/) v3.24 |
| Logging | [Pino](https://getpino.io/) v9.6 |
| Configuration | [js-yaml](https://github.com/nodeca/js-yaml) v4.1 |
| Docker | [Docker](https://www.docker.com/) + [docker-compose](https://docs.docker.com/compose/) |

## Project Structure

```
zercle-bun-template/
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules
├── drizzle.config.ts         # Drizzle ORM configuration
├── package.json              # Project dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── LICENSE.md                # License file
│
├── configs/                  # Configuration files by environment
│   ├── dev.yaml             # Development configuration
│   ├── local.yaml           # Local development configuration
│   ├── prod.yaml            # Production configuration
│   └── uat.yaml             # User acceptance testing configuration
│
├── deployments/              # Deployment configurations
│   └── docker/
│       ├── Dockerfile       # Multi-stage Docker build
│       └── docker-compose.yml # Docker Compose for local development
│
├── drizzle/                  # Database migrations
│   └── migrations/          # Generated migration files
│       └── *_initial_schema.sql
│
├── scripts/                  # Utility scripts
│
└── src/                      # Source code
    ├── main.ts              # Application entry point
    ├── app.ts               # App initialization and route setup
    │
    ├── domain/              # Business logic (DDD)
    │   ├── task/            # Task domain
    │   │   ├── entity/      # Domain entities (Task model)
    │   │   ├── handler/     # HTTP handlers/controllers
    │   │   ├── repository/  # Data access layer
    │   │   ├── request/     # Request validation schemas
    │   │   ├── response/    # Response types
    │   │   └── usecase/     # Business logic use cases
    │   │
    │   └── user/            # User domain
    │       ├── entity/      # Domain entities (User model)
    │       ├── handler/     # HTTP handlers/controllers
    │       ├── repository/  # Data access layer
    │       ├── request/     # Request validation schemas
    │       ├── response/    # Response types
    │       └── usecase/     # Business logic use cases
    │
    ├── infrastructure/      # Infrastructure layer
    │   ├── config/          # Configuration loading and validation
    │   ├── db/              # Database connection and setup
    │   ├── logger/          # Logging service
    │   ├── middleware/      # HTTP middleware
    │   │   ├── auth.ts      # JWT authentication
    │   │   ├── cors.ts      # CORS handling
    │   │   ├── logger.ts    # Request/response logging
    │   │   ├── rate-limit.ts # Rate limiting
    │   │   └── request-id.ts # Request ID generation
    │   └── password/        # Password hashing (Argon2id)
    │
    └── utils/               # Utility functions
        └── response.ts      # JSend-formatted response helpers
```

### Architecture Overview

This template follows **Domain-Driven Design (DDD)** principles with a clear separation of layers:

```
┌─────────────────────────────────────────────────────────────┐
│                      Presentation Layer                      │
│                   (Handlers / Controllers)                   │
├─────────────────────────────────────────────────────────────┤
│                      Application Layer                       │
│                      (Use Cases)                             │
├─────────────────────────────────────────────────────────────┤
│                      Domain Layer                            │
│                   (Entities / Business Logic)                │
├─────────────────────────────────────────────────────────────┤
│                     Infrastructure Layer                     │
│              (DB, Auth, Config, Middleware)                  │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

Before using this template, ensure you have the following installed:

- **Bun** v1.0.0 or higher - [Install](https://bun.sh/docs/installation)
- **Node.js** v18 or higher (for some tooling)
- **PostgreSQL** v15+ (or use Docker)
- **Git** for version control

## Quick Start

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd zercle-bun-template

# Install dependencies
bun install
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

### 3. Set Up Database

**Option A: Using Docker Compose (Recommended)**

```bash
# Start PostgreSQL container
docker-compose -f deployments/docker/docker-compose.yml up -d postgres

# Run database migrations
bun run db:migrate
```

**Option B: Local PostgreSQL**

Ensure PostgreSQL is running locally, then:

```bash
# Run migrations
bun run db:migrate
```

### 4. Start Development Server

```bash
# Start with hot reload
bun run dev
```

The server will start at `http://localhost:3000`.

## Configuration

### Environment Variables

Configure your application using environment variables or `.env` file:

```env
# Server Configuration
SERVER_ENV=local
SERVER_PORT=3000
SERVER_HOST=0.0.0.0

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=postgres
DB_DRIVER=postgres

# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRATION=3600

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=json

# CORS Configuration
# CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080

# Rate Limiting Configuration
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60

# Argon2id Configuration
ARGON2ID_MEMORY=19456
ARGON2ID_ITERATIONS=2
ARGON2ID_PARALLELISM=1
```

### YAML Configuration Files

The application uses YAML configuration files per environment:

| File | Environment | Description |
|------|-------------|-------------|
| `configs/local.yaml` | Local | Local development settings |
| `configs/dev.yaml` | Development | Development environment |
| `configs/uat.yaml` | UAT | User acceptance testing |
| `configs/prod.yaml` | Production | Production settings |

To change the active environment, set `SERVER_ENV`:

```bash
SERVER_ENV=dev bun run dev
```

## Database Setup

### Database Migrations

```bash
# Generate a new migration (after schema changes)
bun run db:generate

# Push schema changes (development only)
bun run db:push

# Run all migrations
bun run db:migrate

# Open Drizzle Studio (database GUI)
bun run db:studio
```

### Database Schema

The database schema is defined in [`src/infrastructure/db/drizzle.ts`](src/infrastructure/db/drizzle.ts). After making changes:

1. Update the schema file
2. Run `bun run db:generate` to create a new migration
3. Review the generated SQL in `drizzle/migrations/`
4. Run `bun run db:migrate` to apply

## Running the Application

### Development Mode

```bash
# Start with hot reload
bun run dev
```

### Production Mode

```bash
# Build the application
bun run build

# Start production server
bun run start
```

### Running Tests

```bash
# Run all tests
bun run test

# Run tests with coverage
bun run test:coverage
```

### Linting and Formatting

```bash
# Check code style
bun run lint
bun run format:check

# Auto-fix issues
bun run lint:fix
bun run format
```

## API Documentation

### Base URL

```
http://localhost:3000
```

### Health Check Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Application health check |
| GET | `/readiness` | Readiness probe (checks DB connection) |

### Authentication Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | ❌ | Register a new user |
| POST | `/api/v1/auth/login` | ❌ | Login and get JWT token |

### User Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/users/profile` | ✅ | Get current user profile |
| PUT | `/api/v1/users/profile` | ✅ | Update user profile |
| DELETE | `/api/v1/users/profile` | ✅ | Delete user account |
| GET | `/api/v1/users` | ✅ | List all users (paginated) |

### Task Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/tasks` | ✅ | Create a new task |
| GET | `/api/v1/tasks` | ✅ | List all tasks (paginated) |
| GET | `/api/v1/tasks/:id` | ✅ | Get task by ID |
| PUT | `/api/v1/tasks/:id` | ✅ | Update a task |
| DELETE | `/api/v1/tasks/:id` | ✅ | Delete a task |

### Request/Response Examples

**Register User**

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "fullName": "John Doe",
  "phone": "+1234567890"
}
```

**Response (201 Created)**

```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Login**

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200 OK)**

```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 3600
  }
}
```

### Error Response Format

All errors follow the JSend specification:

```json
{
  "status": "fail",
  "message": "User not found",
  "data": {
    "field": ["error message"]
  }
}
```

## Docker Deployment

### Building the Image

```bash
# Build the Docker image
docker build -f deployments/docker/Dockerfile -t zercle-bun-app .
```

### Running with Docker Compose

```bash
# Start all services (app + database)
docker-compose -f deployments/docker/docker-compose.yml up -d

# View logs
docker-compose -f deployments/docker/docker-compose.yml logs -f

# Stop services
docker-compose -f deployments/docker/docker-compose.yml down
```

### Production Deployment

```bash
# Set production environment variables
export JWT_SECRET="your-production-secret"
export SERVER_ENV=prod

# Build and run
docker-compose -f deployments/docker/docker-compose.yml up -d --build
```

### Health Checks

The Docker configuration includes health checks for both the application and database:

- **Application Health**: `curl -f http://localhost:3000/health`
- **Database Health**: `pg_isready -U postgres`

## Development Guidelines

### Adding a New Domain

To add a new domain (e.g., `order`):

1. **Create the domain structure:**

```bash
mkdir -p src/domain/order/{entity,handler,repository,request,response,usecase}
```

2. **Define the entity:**

```typescript
// src/domain/order/entity/order.ts
export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrder {
  userId: string;
  items: OrderItem[];
}
```

3. **Create the repository:**

```typescript
// src/domain/order/repository/order.ts
import { DrizzleDatabase } from '../../../infrastructure/db/drizzle.js';
import { Logger } from '../../../infrastructure/logger/logger.js';
import { Order } from '../entity/order.js';

export class OrderRepository {
  constructor(private db: DrizzleDatabase, private logger: Logger) {}

  async findById(id: string): Promise<Order | null> {
    // Implementation
  }

  async create(order: Order): Promise<Order> {
    // Implementation
  }
}
```

4. **Implement use cases:**

```typescript
// src/domain/order/usecase/order.ts
export interface IOrderUseCase {
  createOrder(data: CreateOrder): Promise<Order>;
  getOrder(id: string): Promise<Order>;
}

export class OrderUseCase implements IOrderUseCase {
  // Implementation
}
```

5. **Create request validation:**

```typescript
// src/domain/order/request/order.ts
import { z } from 'zod';

export const createOrderSchema = z.object({
  userId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
  })),
});
```

6. **Create HTTP handler:**

```typescript
// src/domain/order/handler/order.ts
import { Context } from 'hono';
import { IOrderUseCase } from '../usecase/order.js';
import { success, created } from '../../../utils/response.js';

export class OrderHandler {
  constructor(private useCase: IOrderUseCase) {}

  async createOrder(c: Context) {
    const body = await c.req.json();
    const validatedData = createOrderSchema.parse(body);
    const order = await this.useCase.createOrder(validatedData);
    return created(c, order);
  }
}
```

7. **Register routes in `app.ts`:**

```typescript
// In setupDependencies()
const orderRepo = new OrderRepository(this.db, this.logger);
const orderUseCase = new OrderUseCase(orderRepo, this.logger);
const orderHandler = new OrderHandler(orderUseCase);

// In registerOrderRoutes()
private registerOrderRoutes(handler: OrderHandler) {
  const protectedRoutes = this.hono.basePath('/api/v1');
  protectedRoutes.use('/orders*', createAuthMiddleware(this.config.jwt));
  
  protectedRoutes.post('/orders', (c) => handler.createOrder(c));
  protectedRoutes.get('/orders/:id', (c) => handler.getOrder(c));
}
```

### Code Style

- Use **ES modules** (`import`/`export`)
- Follow **strict TypeScript** mode
- Use **Zod** for input validation
- Return **JSend-formatted** responses
- Use **async/await** for all async operations
- Implement **proper error handling** with typed errors

### Naming Conventions

| Component | Convention | Example |
|-----------|------------|---------|
| Files | kebab-case | `user-handler.ts` |
| Classes | PascalCase | `UserRepository` |
| Interfaces | PascalCase | `IUserService` |
| Variables/Functions | camelCase | `getUserById` |
| Constants | UPPER_SNAKE_CASE | `MAX_REQUESTS` |
| Database Tables | snake_case | `user_accounts` |

## Testing

### Writing Tests

Create test files with `.test.ts` extension:

```typescript
// src/domain/user/usecase/user.test.ts
import { describe, it, expect } from 'bun:test';

describe('User UseCase', () => {
  it('should register a new user', async () => {
    // Test implementation
  });
});
```

### Running Tests

```bash
# Run all tests
bun test

# Run with coverage report
bun run test:coverage

# Run specific test file
bun test src/domain/user/usecase/user.test.ts
```

## Contributing

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit changes** (`git commit -m 'Add amazing feature'`)
4. **Push to branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Commit Message Format

```
type(scope): description

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation changes
- style: Code style changes
- refactor: Code refactoring
- test: Test additions
- chore: Maintenance

Example: feat(user): add password reset functionality
```

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

---

<div align="center">

Built with ❤️ using [Bun](https://bun.sh/) and [Hono](https://hono.dev/)

</div>
