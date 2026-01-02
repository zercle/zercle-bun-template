# =============================================================================
# Zercle Bun Template - Makefile
# =============================================================================
# A comprehensive Makefile for the Bun-based RESTful API template
# Using Hono framework with PostgreSQL and Drizzle ORM
# =============================================================================

# -----------------------------------------------------------------------------
# Configuration Variables
# -----------------------------------------------------------------------------
BUN := bun
DOCKER_COMPOSE := docker-compose
DOCKER_COMPOSE_TEST := docker-compose -f deployments/docker/docker-compose.test.yml
DOCKER_COMPOSE_PROD := docker-compose -f deployments/docker/docker-compose.yml

# Colors for terminal output
GREEN := \033[0;32m
BLUE := \033[0;34m
YELLOW := \033[0;33m
RED := \033[0;31m
CYAN := \033[0;36m
RESET := \033[0m

# -----------------------------------------------------------------------------
# Development Targets
# -----------------------------------------------------------------------------
.PHONY: install dev build start

install:  # Install dependencies using bun install
	@echo "$(GREEN)Installing dependencies...$(RESET)"
	@$(BUN) install

dev:  # Run development server with hot reload
	@echo "$(GREEN)Starting development server...$(RESET)"
	@$(BUN) run dev

build:  # Build the project for production
	@echo "$(GREEN)Building project...$(RESET)"
	@$(BUN) run build

start:  # Start production server
	@echo "$(GREEN)Starting production server...$(RESET)"
	@$(BUN) run start

# -----------------------------------------------------------------------------
# Testing Targets
# -----------------------------------------------------------------------------
.PHONY: test test:unit test:integration test:coverage test:watch

test:  # Run all tests
	@echo "$(GREEN)Running all tests...$(RESET)"
	@$(BUN) run test

test:unit:  # Run unit tests only
	@echo "$(GREEN)Running unit tests...$(RESET)"
	@$(BUN) run test tests/unit/

test:integration:  # Run integration tests only
	@echo "$(GREEN)Running integration tests...$(RESET)"
	@$(BUN) run test:integration

test:coverage:  # Run tests with coverage report
	@echo "$(GREEN)Running tests with coverage...$(RESET)"
	@$(BUN) run test:coverage

test:watch:  # Run tests in watch mode
	@echo "$(GREEN)Running tests in watch mode...$(RESET)"
	@$(BUN) run test --watch

# -----------------------------------------------------------------------------
# Code Quality Targets
# -----------------------------------------------------------------------------
.PHONY: lint lint:fix format format:check check

lint:  # Run linter to check code quality
	@echo "$(GREEN)Running linter...$(RESET)"
	@$(BUN) run lint

lint:fix  # Fix linting issues automatically
	@echo "$(GREEN)Fixing linting issues...$(RESET)"
	@$(BUN) run lint:fix

format:  # Format code using Prettier
	@echo "$(GREEN)Formatting code...$(RESET)"
	@$(BUN) run format

format:check:  # Check code formatting without modifying
	@echo "$(GREEN)Checking code formatting...$(RESET)"
	@$(BUN) run format:check

check:  # Run all checks (lint + format:check)
	@echo "$(GREEN)Running all code quality checks...$(RESET)"
	@$(BUN) run lint
	@$(BUN) run format:check

# -----------------------------------------------------------------------------
# Database Targets
# -----------------------------------------------------------------------------
.PHONY: db:generate db:push db:migrate db:studio

db:generate:  # Generate database migrations from schema
	@echo "$(GREEN)Generating database migrations...$(RESET)"
	@$(BUN) run db:generate

db:push:  # Push schema changes to database (development)
	@echo "$(GREEN)Pushing schema to database...$(RESET)"
	@$(BUN) run db:push

db:migrate:  # Run pending database migrations
	@echo "$(GREEN)Running database migrations...$(RESET)"
	@$(BUN) run db:migrate

db:studio:  # Open Drizzle Studio for database management
	@echo "$(GREEN)Opening Drizzle Studio...$(RESET)"
	@$(BUN) run db:studio

# -----------------------------------------------------------------------------
# Docker Targets
# -----------------------------------------------------------------------------
.PHONY: docker:build docker:up docker:down docker:logs docker:clean

docker:build:  # Build Docker image for production
	@echo "$(GREEN)Building Docker image...$(RESET)"
	@$(DOCKER_COMPOSE_PROD) build

docker:up:  # Start Docker containers in detached mode
	@echo "$(GREEN)Starting Docker containers...$(RESET)"
	@$(DOCKER_COMPOSE_PROD) up -d

docker:down:  # Stop Docker containers
	@echo "$(GREEN)Stopping Docker containers...$(RESET)"
	@$(DOCKER_COMPOSE_PROD) down

docker:logs:  # View Docker container logs with follow
	@echo "$(GREEN)Viewing Docker logs (Ctrl+C to exit)...$(RESET)"
	@$(DOCKER_COMPOSE_PROD) logs -f

docker:clean:  # Remove Docker containers, networks, and volumes
	@echo "$(RED)Cleaning up Docker resources...$(RESET)"
	@$(DOCKER_COMPOSE_PROD) down -v

# -----------------------------------------------------------------------------
# Docker Test Targets
# -----------------------------------------------------------------------------
.PHONY: docker:test:up docker:test:down docker:test:logs

docker:test:up:  # Start test database container
	@echo "$(GREEN)Starting test database...$(RESET)"
	@$(DOCKER_COMPOSE_TEST) up -d

docker:test:down:  # Stop test database container
	@echo "$(GREEN)Stopping test database...$(RESET)"
	@$(DOCKER_COMPOSE_TEST) down -v

docker:test:logs:  # View test container logs
	@echo "$(GREEN)Viewing test container logs...$(RESET)"
	@$(DOCKER_COMPOSE_TEST) logs -f

# -----------------------------------------------------------------------------
# Utility Targets
# -----------------------------------------------------------------------------
.PHONY: clean clean:build fresh help

clean:  # Clean all build artifacts and node_modules
	@echo "$(RED)Cleaning all build artifacts...$(RESET)"
	@rm -rf dist
	@rm -rf node_modules
	@rm -rf .bun
	@echo "$(GREEN)Clean complete!$(RESET)"

clean:build:  # Clean build artifacts only (keep node_modules)
	@echo "$(YELLOW)Cleaning build artifacts...$(RESET)"
	@rm -rf dist
	@rm -rf .bun
	@echo "$(GREEN)Build artifacts cleaned!$(RESET)"

fresh:  # Clean and reinstall dependencies
	@echo "$(CYAN)Performing fresh install...$(RESET)"
	@$(MAKE) clean
	@$(MAKE) install

help:  # Display this help message
	@echo ""
	@echo "$(CYAN)========================================$(RESET)"
	@echo "$(CYAN)  Zercle Bun Template - Available Commands$(RESET)"
	@echo "$(CYAN)========================================$(RESET)"
	@echo ""
	@echo "$(BLUE)Development:$(RESET)"
	@echo "  $(YELLOW)make install$(RESET)       Install dependencies"
	@echo "  $(YELLOW)make dev$(RESET)           Start development server"
	@echo "  $(YELLOW)make build$(RESET)         Build for production"
	@echo "  $(YELLOW)make start$(RESET)         Start production server"
	@echo ""
	@echo "$(BLUE)Testing:$(RESET)"
	@echo "  $(YELLOW)make test$(RESET)          Run all tests"
	@echo "  $(YELLOW)make test:unit$(RESET)     Run unit tests"
	@echo "  $(YELLOW)make test:integration$(RESET) Run integration tests"
	@echo "  $(YELLOW)make test:coverage$(RESET) Run tests with coverage"
	@echo "  $(YELLOW)make test:watch$(RESET)    Run tests in watch mode"
	@echo ""
	@echo "$(BLUE)Code Quality:$(RESET)"
	@echo "  $(YELLOW)make lint$(RESET)          Run linter"
	@echo "  $(YELLOW)make lint:fix$(RESET)      Fix linting issues"
	@echo "  $(YELLOW)make format$(RESET)        Format code"
	@echo "  $(YELLOW)make format:check$(RESET)  Check formatting"
	@echo "  $(YELLOW)make check$(RESET)         Run all checks"
	@echo ""
	@echo "$(BLUE)Database:$(RESET)"
	@echo "  $(YELLOW)make db:generate$(RESET)   Generate migrations"
	@echo "  $(YELLOW)make db:push$(RESET)       Push schema to DB"
	@echo "  $(YELLOW)make db:migrate$(RESET)    Run migrations"
	@echo "  $(YELLOW)make db:studio$(RESET)     Open Drizzle Studio"
	@echo ""
	@echo "$(BLUE)Docker (Production):$(RESET)"
	@echo "  $(YELLOW)make docker:build$(RESET)  Build Docker image"
	@echo "  $(YELLOW)make docker:up$(RESET)     Start containers"
	@echo "  $(YELLOW)make docker:down$(RESET)   Stop containers"
	@echo "  $(YELLOW)make docker:logs$(RESET)   View logs"
	@echo "  $(YELLOW)make docker:clean$(RESET)  Remove containers & volumes"
	@echo ""
	@echo "$(BLUE)Docker (Testing):$(RESET)"
	@echo "  $(YELLOW)make docker:test:up$(RESET)   Start test DB"
	@echo "  $(YELLOW)make docker:test:down$(RESET) Stop test DB"
	@echo "  $(YELLOW)make docker:test:logs$(RESET) View test logs"
	@echo ""
	@echo "$(BLUE)Utilities:$(RESET)"
	@echo "  $(YELLOW)make clean$(RESET)         Clean all artifacts"
	@echo "  $(YELLOW)make clean:build$(RESET)   Clean build only"
	@echo "  $(YELLOW)make fresh$(RESET)         Clean + reinstall"
	@echo "  $(YELLOW)make help$(RESET)          Show this help"
	@echo ""
	@echo "$(CYAN)========================================$(RESET)"
	@echo ""

.PHONY: default
default: help
