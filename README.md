# Zercle Bun Template

A production-ready Bun + Hono.js REST API template with JWT authentication, following Clean Architecture principles.

## Features

- **Runtime**: [Bun](https://bun.sh/) - Fast JavaScript runtime
- **Framework**: [Hono.js](https://hono.dev/) - Lightweight web framework
- **Database**: PostgreSQL with [Drizzle ORM](https://orm.drizzle.team/)
- **Authentication**: JWT with refresh tokens
- **Validation**: [Zod](https://zod.dev/) for runtime validation
- **Logging**: [Pino](https://getpino.io/) for structured logging
- **Password Hashing**: [Argon2](https://github.com/ranisalt/node-argon2) (OWASP recommended)
- **Testing**: Bun's native test runner
- **Code Quality**: [Biome](https://biomejs.dev/) for linting and formatting
- **Docker**: Multi-stage builds with development and production targets

## Architecture

This template follows Clean Architecture principles:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Presentation Layer                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Handlers (HTTP)                                            │ │
│  │  - Route definitions                                        │ │
│  │  - Request validation (Zod)                                 │ │
│  │  - Response formatting                                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                        Application Layer                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Services (Usecases)                                        │ │
│  │  - Business logic                                           │ │
│  │  - Orchestration                                            │ │
│  │  - Transaction management                                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                           Domain Layer                           │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Entities                                                   │ │
│  │  - Core business objects                                    │ │
│  │  - Domain rules                                             │ │
│  │  - Value objects                                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                       Infrastructure Layer                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Repository Implementations                                 │ │
│  │  - Database access (Drizzle)                                │ │
│  │  - External services                                        │ │
│  │  - Logger, Config, etc.                                     │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- [PostgreSQL](https://www.postgresql.org/) >= 14

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd zercle-bun-template
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run database migrations:
```bash
bun run db:migrate
```

5. Start the development server:
```bash
bun run dev
```

The server will be running at `http://localhost:3000`.

## API Endpoints

### Health Check
- `GET /health` - Health check endpoint

### Users
- `POST /api/v1/users` - Register a new user
- `POST /api/v1/users/login` - Login and get tokens
- `GET /api/v1/users` - List users (requires authentication)
- `GET /api/v1/users/:id` - Get user by ID (requires authentication)
- `PUT /api/v1/users/:id` - Update user (requires authentication)
- `DELETE /api/v1/users/:id` - Delete user (requires authentication)

### Authentication
- `POST /api/v1/auth/refresh` - Refresh access token

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development, production, test) | `development` |
| `APP_NAME` | Application name | `zercle-bun-template` |
| `APP_VERSION` | Application version | `1.0.0` |
| `HOST` | Host to bind to | `0.0.0.0` |
| `PORT` | Port to listen on | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_SECRET` | Secret key for JWT signing (min 32 chars) | - |
| `JWT_ACCESS_TTL` | Access token TTL | `15m` |
| `JWT_REFRESH_TTL` | Refresh token TTL | `7d` |
| `ARGON2_MEMORY` | Argon2 memory cost (KB) | `65536` |
| `ARGON2_ITERATIONS` | Argon2 iterations | `3` |
| `ARGON2_PARALLELISM` | Argon2 parallelism | `4` |
| `LOG_LEVEL` | Log level | `info` |
| `LOG_FORMAT` | Log format (json, pretty) | `json` |

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server with hot reload |
| `bun run start` | Start production server |
| `bun run build` | Build the application |
| `bun run test` | Run all tests |
| `bun run test:unit` | Run unit tests |
| `bun run test:integration` | Run integration tests |
| `bun run test:coverage` | Run tests with coverage |
| `bun run lint` | Lint the code |
| `bun run lint:fix` | Fix linting issues |
| `bun run format` | Format the code |
| `bun run db:generate` | Generate database migrations |
| `bun run db:migrate` | Run database migrations |
| `bun run db:push` | Push schema to database (development) |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run docker:build` | Build Docker image |
| `bun run docker:compose` | Start services with Docker Compose |

## Docker

Build and run with Docker:

```bash
# Build the image
docker build -t zercle-bun-template .

# Run with Docker Compose
docker-compose up -d
```

## Testing

Run the test suite:

```bash
# Run all tests
bun test

# Run tests with coverage
bun test:coverage

# Run tests in watch mode
bun test:watch
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.