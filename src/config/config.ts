import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { z } from 'zod';

const DurationSchema = z.string().regex(/^\d+(s|m|h|d)$/);

const ConfigSchema = z.object({
  server_host: z.string().default('0.0.0.0'),
  server_port: z.coerce.number().int().default(3000),
  db_host: z.string().default('localhost'),
  db_port: z.coerce.number().int().default(5432),
  db_name: z.string(),
  db_user: z.string(),
  db_password: z.string().default(''),
  db_ssl_mode: z.string().default('disable'),
  db_max_conns: z.coerce.number().int().default(10),
  db_max_idle_conns: z.coerce.number().int().default(5),
  cache_host: z.string().default('localhost'),
  cache_port: z.coerce.number().int().default(6379),
  cache_password: z.string().default(''),
  cache_db: z.coerce.number().int().default(0),
  auth_access_token_secret: z.string(),
  auth_refresh_token_secret: z.string(),
  auth_access_token_ttl: DurationSchema.default('24h'),
  auth_refresh_token_ttl: DurationSchema.default('168h'),
  auth_issuer: z.string().default('zercle-bun-template'),
  log_level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  log_format: z.enum(['json', 'text']).default('json'),
  metrics_enabled: z.coerce.boolean().default(false),
  metrics_port: z.coerce.number().int().default(9090),
  tracing_enabled: z.coerce.boolean().default(false),
  tracing_endpoint: z.string().default(''),
  otel_service_name: z.string().default('zercle-bun-template'),
  app_environment: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

export type RawConfig = z.infer<typeof ConfigSchema>;

export interface Config {
  serverHost: string;
  serverPort: number;
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbSslMode: string;
  dbMaxConns: number;
  dbMaxIdleConns: number;
  cacheHost: string;
  cachePort: number;
  cachePassword: string;
  cacheDb: number;
  authAccessTokenSecret: string;
  authRefreshTokenSecret: string;
  authAccessTokenTtl: number; // milliseconds
  authRefreshTokenTtl: number; // milliseconds
  authIssuer: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logFormat: 'json' | 'text';
  metricsEnabled: boolean;
  metricsPort: number;
  tracingEnabled: boolean;
  tracingEndpoint: string;
  otelServiceName: string;
  appEnvironment: 'development' | 'production' | 'test';
}

function parseDuration(value: string): number {
  const match = value.match(/^(\d+)(s|m|h|d)$/);
  if (!match || !match[1] || !match[2])
    throw new Error(`Invalid duration: ${value}`);
  const num = match[1];
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  const multiplier = multipliers[unit];
  if (multiplier === undefined)
    throw new Error(`Unknown duration unit: ${unit}`);
  return Number.parseInt(num) * multiplier;
}

function mapEnvToConfig(
  env: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const mapping: Record<string, string> = {
    SERVER_HOST: 'server_host',
    SERVER_PORT: 'server_port',
    DB_HOST: 'db_host',
    DB_PORT: 'db_port',
    DB_NAME: 'db_name',
    DB_USER: 'db_user',
    DB_PASSWORD: 'db_password',
    DB_SSL_MODE: 'db_ssl_mode',
    DB_MAX_CONNS: 'db_max_conns',
    DB_MAX_IDLE_CONNS: 'db_max_idle_conns',
    CACHE_HOST: 'cache_host',
    CACHE_PORT: 'cache_port',
    CACHE_PASSWORD: 'cache_password',
    CACHE_DB: 'cache_db',
    AUTH_ACCESS_TOKEN_SECRET: 'auth_access_token_secret',
    AUTH_REFRESH_TOKEN_SECRET: 'auth_refresh_token_secret',
    AUTH_ACCESS_TOKEN_TTL: 'auth_access_token_ttl',
    AUTH_REFRESH_TOKEN_TTL: 'auth_refresh_token_ttl',
    AUTH_ISSUER: 'auth_issuer',
    LOG_LEVEL: 'log_level',
    LOG_FORMAT: 'log_format',
    METRICS_ENABLED: 'metrics_enabled',
    METRICS_PORT: 'metrics_port',
    TRACING_ENABLED: 'tracing_enabled',
    TRACING_ENDPOINT: 'tracing_endpoint',
    OTEL_SERVICE_NAME: 'otel_service_name',
    APP_ENVIRONMENT: 'app_environment',
  };

  const result: Record<string, string | undefined> = {};
  for (const [envKey, configKey] of Object.entries(mapping)) {
    if (env[envKey] !== undefined) {
      result[configKey] = env[envKey];
    }
  }
  return result;
}

export function loadConfig(configFilePath?: string): Config {
  // Load defaults from YAML
  let yamlConfig: Record<string, unknown> = {};
  const yamlPath = configFilePath ?? 'config.yaml';
  try {
    const yamlContent = readFileSync(yamlPath, 'utf-8');
    yamlConfig = yaml.load(yamlContent) as Record<string, unknown>;
  } catch {
    // config.yaml is optional; env vars can supply all values
  }

  // Overlay environment variables (env vars take precedence)
  const envOverrides = mapEnvToConfig(
    process.env as Record<string, string | undefined>,
  );

  const merged = { ...yamlConfig, ...envOverrides };

  const raw = ConfigSchema.parse(merged);

  return {
    serverHost: raw.server_host,
    serverPort: raw.server_port,
    dbHost: raw.db_host,
    dbPort: raw.db_port,
    dbName: raw.db_name,
    dbUser: raw.db_user,
    dbPassword: raw.db_password,
    dbSslMode: raw.db_ssl_mode,
    dbMaxConns: raw.db_max_conns,
    dbMaxIdleConns: raw.db_max_idle_conns,
    cacheHost: raw.cache_host,
    cachePort: raw.cache_port,
    cachePassword: raw.cache_password,
    cacheDb: raw.cache_db,
    authAccessTokenSecret: raw.auth_access_token_secret,
    authRefreshTokenSecret: raw.auth_refresh_token_secret,
    authAccessTokenTtl: parseDuration(raw.auth_access_token_ttl),
    authRefreshTokenTtl: parseDuration(raw.auth_refresh_token_ttl),
    authIssuer: raw.auth_issuer,
    logLevel: raw.log_level,
    logFormat: raw.log_format,
    metricsEnabled: raw.metrics_enabled,
    metricsPort: raw.metrics_port,
    tracingEnabled: raw.tracing_enabled,
    tracingEndpoint: raw.tracing_endpoint,
    otelServiceName: raw.otel_service_name,
    appEnvironment: raw.app_environment,
  };
}

export function dbConnString(cfg: Config): string {
  return `postgres://${cfg.dbUser}:${cfg.dbPassword}@${cfg.dbHost}:${cfg.dbPort}/${cfg.dbName}?sslmode=${cfg.dbSslMode}`;
}

export function serverAddr(cfg: Config): string {
  return `${cfg.serverHost}:${cfg.serverPort}`;
}

export function cacheAddr(cfg: Config): string {
  return `${cfg.cacheHost}:${cfg.cachePort}`;
}
