import { readFileSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";
import { z } from "zod";

// Configuration schemas with validation
const ServerConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  env: z.string(),
});

const DatabaseConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  user: z.string().min(1),
  password: z.string().min(1),
  dbname: z.string().min(1),
  driver: z.string().default("postgres"),
  max_conns: z.number().int().positive().default(25),
  min_conns: z.number().int().nonnegative().default(5),
  max_conn_lifetime: z.string().default("1h"),
  max_conn_idletime: z.string().default("10m"),
  health_check_period: z.string().default("1m"),
});

const JWTConfigSchema = z.object({
  secret: z.string().min(1),
  expiration: z.number().int().positive().default(3600),
});

const LoggingConfigSchema = z.object({
  level: z.enum(["debug", "info", "warn", "error", "fatal"]).default("info"),
  format: z.enum(["console", "json"]).default("json"),
});

const CORSConfigSchema = z.object({
  allowed_origins: z.array(z.string()).default(["*"]),
});

const RateLimitConfigSchema = z.object({
  requests: z.number().int().positive().default(100),
  window: z.number().int().positive().default(60),
});

const Argon2idConfigSchema = z.object({
  memory: z.number().int().positive().default(19456),
  iterations: z.number().int().positive().default(2),
  parallelism: z.number().int().positive().default(1),
  salt_length: z.number().int().positive().default(16),
  key_length: z.number().int().positive().default(32),
});

const ConfigSchema = z.object({
  server: ServerConfigSchema,
  database: DatabaseConfigSchema,
  jwt: JWTConfigSchema,
  logging: LoggingConfigSchema,
  cors: CORSConfigSchema,
  rate_limit: RateLimitConfigSchema,
  argon2id: Argon2idConfigSchema,
});

export interface ServerConfig {
  host: string;
  port: number;
  env: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  dbname: string;
  driver: string;
  max_conns: number;
  min_conns: number;
  max_conn_lifetime: string;
  max_conn_idletime: string;
  health_check_period: string;
}

export interface JWTConfig {
  secret: string;
  expiration: number;
}

export interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error" | "fatal";
  format: "console" | "json";
}

export interface CORSConfig {
  allowed_origins: string[];
}

export interface RateLimitConfig {
  requests: number;
  window: number;
}

export interface Argon2idConfig {
  memory: number;
  iterations: number;
  parallelism: number;
  salt_length: number;
  key_length: number;
}

export interface Config {
  server: ServerConfig;
  database: DatabaseConfig;
  jwt: JWTConfig;
  logging: LoggingConfig;
  cors: CORSConfig;
  rate_limit: RateLimitConfig;
  argon2id: Argon2idConfig;
}

/**
 * Load configuration from YAML file and override with environment variables
 */
export function loadConfig(configPath?: string): Config {
  const env = process.env.SERVER_ENV ?? "local";
  const configFilePath =
    configPath ?? resolve(process.cwd(), `configs/${env}.yaml`);

  try {
    const fileContents = readFileSync(configFilePath, "utf8");
    const config = yaml.load(fileContents) as Record<string, unknown>;

    // Override with environment variables
    if (process.env.SERVER_HOST) config.server.host = process.env.SERVER_HOST;
    if (process.env.SERVER_PORT)
      config.server.port = parseInt(process.env.SERVER_PORT, 10);
    if (process.env.SERVER_ENV) config.server.env = process.env.SERVER_ENV;

    if (process.env.DATABASE_HOST) config.database.host = process.env.DATABASE_HOST;
    else if (process.env.DB_HOST) config.database.host = process.env.DB_HOST;
    if (process.env.DATABASE_PORT)
      config.database.port = parseInt(process.env.DATABASE_PORT, 10);
    else if (process.env.DB_PORT)
      config.database.port = parseInt(process.env.DB_PORT, 10);
    if (process.env.DATABASE_USER) config.database.user = process.env.DATABASE_USER;
    else if (process.env.DB_USER) config.database.user = process.env.DB_USER;
    if (process.env.DATABASE_PASSWORD)
      config.database.password = process.env.DATABASE_PASSWORD;
    else if (process.env.DB_PASSWORD)
      config.database.password = process.env.DB_PASSWORD;
    if (process.env.DATABASE_NAME) config.database.dbname = process.env.DATABASE_NAME;
    else if (process.env.DB_NAME) config.database.dbname = process.env.DB_NAME;
    if (process.env.DATABASE_DRIVER) config.database.driver = process.env.DATABASE_DRIVER;
    else if (process.env.DB_DRIVER) config.database.driver = process.env.DB_DRIVER;

    if (process.env.JWT_SECRET) config.jwt.secret = process.env.JWT_SECRET;
    if (process.env.JWT_EXPIRATION)
      config.jwt.expiration = parseInt(process.env.JWT_EXPIRATION, 10);

    if (process.env.LOG_LEVEL)
      config.logging.level = process.env.LOG_LEVEL as LoggingConfig["level"];
    if (process.env.LOG_FORMAT)
      config.logging.format = process.env.LOG_FORMAT as LoggingConfig["format"];

    if (process.env.ARGON2ID_MEMORY)
      config.argon2id.memory = parseInt(process.env.ARGON2ID_MEMORY, 10);
    if (process.env.ARGON2ID_ITERATIONS)
      config.argon2id.iterations = parseInt(
        process.env.ARGON2ID_ITERATIONS,
        10,
      );
    if (process.env.ARGON2ID_PARALLELISM)
      config.argon2id.parallelism = parseInt(
        process.env.ARGON2ID_PARALLELISM,
        10,
      );

    if (process.env.RATE_LIMIT_REQUESTS)
      config.rate_limit.requests = parseInt(
        process.env.RATE_LIMIT_REQUESTS,
        10,
      );
    if (process.env.RATE_LIMIT_WINDOW)
      config.rate_limit.window = parseInt(process.env.RATE_LIMIT_WINDOW, 10);

    // Validate configuration
    return ConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
    throw error;
  }
}
