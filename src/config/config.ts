/**
 * Application configuration loader.
 *
 * Mirrors the Go template's `internal/config/config.go`:
 *   1. Read `config.yaml` from CWD (override via `CONFIG_FILE` env).
 *   2. Apply env overrides per leaf binding (env wins over file).
 *   3. Validate the merged object with a single Zod schema; durations are
 *      stored as **seconds (number)** in the typed `Config` — input strings
 *      like `"15s"`, `"30m"`, `"1h"` (and bare numbers) are accepted by the
 *      schema and converted to seconds.
 *   4. Run cross-section validation (fail-fast via `ConfigError`).
 */
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import YAML from "yaml";
import { z } from "zod";

/** Symbol used to register the resolved `Config` in the DI container. */
export const ConfigKey = Symbol("Config");

/** Thrown by `loadConfig` when validation fails (schema or cross-section). */
export class ConfigError extends Error {
  override readonly name = "ConfigError";
}

// ---------- duration handling -------------------------------------------------

const DURATION_RE = /^(\d+(?:\.\d+)?)(ms|s|m|h)?$/;

/**
 * Parse a duration value into seconds.
 *
 * Accepts:
 *   - numbers (treated as seconds)
 *   - bare numeric strings (`"90"` -> 90)
 *   - suffixed strings (`"15s"`, `"30m"`, `"1h"`, `"250ms"`, `"1.5m"`)
 *
 * Returns seconds as a number. Throws on unrecognised input.
 */
export function parseDurationToSeconds(value: string | number): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new ConfigError(`invalid duration: ${value}`);
    }
    return value;
  }
  const trimmed = value.trim();
  const match = DURATION_RE.exec(trimmed);
  if (!match) {
    throw new ConfigError(`invalid duration: ${value}`);
  }
  const n = Number(match[1]);
  const unit = match[2] ?? "s";
  switch (unit) {
    case "ms":
      return n / 1000;
    case "s":
      return n;
    case "m":
      return n * 60;
    case "h":
      return n * 3600;
  }
  throw new ConfigError(`invalid duration: ${value}`);
}

/** Zod helper: accept string|number input, output seconds (number). */
const durationSeconds = z.union([z.string(), z.number()]).transform((v, ctx) => {
  try {
    return parseDurationToSeconds(v);
  } catch (err) {
    ctx.addIssue({
      code: "custom",
      message: err instanceof Error ? err.message : `invalid duration: ${String(v)}`,
    });
    return z.NEVER;
  }
});

// ---------- enums -------------------------------------------------------------

const EnvironmentEnum = z.enum(["development", "staging", "production", "test"]);
const SSLModeEnum = z.enum(["disable", "prefer", "require", "verify-ca", "verify-full"]);
const OTelExporterEnum = z.enum(["otlp", "none"]);
const LogLevelEnum = z.enum(["trace", "debug", "info", "warn", "error", "fatal"]);
const LogFormatEnum = z.enum(["json", "console"]);

// ---------- schemas -----------------------------------------------------------

const AppSchema = z.object({
  name: z.string().min(1).default("zercle-bun-template"),
  environment: EnvironmentEnum.default("development"),
  host: z.string().min(1).default("0.0.0.0"),
  port: z.number().int().min(1).max(65535).default(8080),
  shutdown_timeout: durationSeconds.default(15),
});

const HTTPSchema = z.object({
  host: z.string().min(1).default("0.0.0.0"),
  port: z.number().int().min(1).max(65535).default(8080),
  read_timeout: durationSeconds.default(15),
  write_timeout: durationSeconds.default(15),
  idle_timeout: durationSeconds.default(60),
  body_limit: z.string().min(1).default("1M"),
  health_probe_timeout: durationSeconds.default(5),
  cors_allow_origins: z.array(z.string()).default([]),
  cors_allow_methods: z
    .array(z.string())
    .default(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]),
  cors_allow_headers: z
    .array(z.string())
    .default(["Authorization", "Content-Type", "X-Request-ID"]),
});

const DBSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  name: z.string().min(1),
  user: z.string().min(1),
  password: z.string(),
  ssl_mode: SSLModeEnum.default("disable"),
  max_conns: z.number().int().min(1).default(10),
  min_conns: z.number().int().min(0).default(2),
  max_conn_idle: durationSeconds.default(1800),
  max_conn_life: durationSeconds.default(3600),
  connect_timeout: durationSeconds.default(5),
});

const ValkeySchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  password: z.string().default(""),
  db: z.number().int().min(0).default(0),
  connect_timeout: durationSeconds.default(5),
});

const OTelSchema = z.object({
  exporter: OTelExporterEnum.default("none"),
  endpoint: z.string().default(""),
  service_name: z.string().min(1).default("zercle-bun-template"),
  sampling: z.number().min(0).max(1).default(1.0),
});

const LogSchema = z.object({
  level: LogLevelEnum.default("info"),
  format: LogFormatEnum.default("json"),
});

const ExampleSchema = z.object({
  enabled: z.boolean().default(false),
  default_page_size: z.number().int().min(1).default(20),
  max_page_size: z.number().int().min(1).default(100),
  max_name_length: z.number().int().min(1).default(255),
});

export const ConfigSchema = z.object({
  app: AppSchema,
  http: HTTPSchema,
  db: DBSchema,
  valkey: ValkeySchema,
  otel: OTelSchema,
  log: LogSchema,
  example: ExampleSchema,
});

/** Resolved configuration. Inferred from `ConfigSchema`; durations are `number` (seconds). */
export type Config = z.infer<typeof ConfigSchema>;

// ---------- env binding -------------------------------------------------------

type EnvPrimitive = string | number | boolean | string[];

interface LeafBinding {
  /** Dotted config path, e.g. "app.port". */
  key: string;
  /** Env var name, e.g. "APP_PORT". */
  envName: string;
  /** How to parse the env string into the right primitive. */
  parse: (raw: string) => EnvPrimitive;
}

const COMMA_SPLIT = (raw: string): string[] =>
  raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

/** Explicit leaf->env bindings, mirroring Go `leafBindings()`. */
const LEAF_BINDINGS: readonly LeafBinding[] = [
  // app
  { key: "app.name", envName: "APP_NAME", parse: (v) => v },
  { key: "app.environment", envName: "APP_ENVIRONMENT", parse: (v) => v },
  { key: "app.host", envName: "APP_HOST", parse: (v) => v },
  { key: "app.port", envName: "APP_PORT", parse: (v) => Number(v) },
  { key: "app.shutdown_timeout", envName: "APP_SHUTDOWN_TIMEOUT", parse: (v) => v },
  // http
  { key: "http.host", envName: "HTTP_HOST", parse: (v) => v },
  { key: "http.port", envName: "HTTP_PORT", parse: (v) => Number(v) },
  { key: "http.read_timeout", envName: "HTTP_READ_TIMEOUT", parse: (v) => v },
  { key: "http.write_timeout", envName: "HTTP_WRITE_TIMEOUT", parse: (v) => v },
  { key: "http.idle_timeout", envName: "HTTP_IDLE_TIMEOUT", parse: (v) => v },
  { key: "http.body_limit", envName: "HTTP_BODY_LIMIT", parse: (v) => v },
  { key: "http.health_probe_timeout", envName: "HTTP_HEALTH_PROBE_TIMEOUT", parse: (v) => v },
  { key: "http.cors_allow_origins", envName: "HTTP_CORS_ALLOW_ORIGINS", parse: COMMA_SPLIT },
  { key: "http.cors_allow_methods", envName: "HTTP_CORS_ALLOW_METHODS", parse: COMMA_SPLIT },
  { key: "http.cors_allow_headers", envName: "HTTP_CORS_ALLOW_HEADERS", parse: COMMA_SPLIT },
  // db
  { key: "db.host", envName: "DB_HOST", parse: (v) => v },
  { key: "db.port", envName: "DB_PORT", parse: (v) => Number(v) },
  { key: "db.name", envName: "DB_NAME", parse: (v) => v },
  { key: "db.user", envName: "DB_USER", parse: (v) => v },
  { key: "db.password", envName: "DB_PASSWORD", parse: (v) => v },
  { key: "db.ssl_mode", envName: "DB_SSL_MODE", parse: (v) => v },
  { key: "db.max_conns", envName: "DB_MAX_CONNS", parse: (v) => Number(v) },
  { key: "db.min_conns", envName: "DB_MIN_CONNS", parse: (v) => Number(v) },
  { key: "db.max_conn_idle", envName: "DB_MAX_CONN_IDLE", parse: (v) => v },
  { key: "db.max_conn_life", envName: "DB_MAX_CONN_LIFE", parse: (v) => v },
  { key: "db.connect_timeout", envName: "DB_CONNECT_TIMEOUT", parse: (v) => v },
  // valkey
  { key: "valkey.host", envName: "VALKEY_HOST", parse: (v) => v },
  { key: "valkey.port", envName: "VALKEY_PORT", parse: (v) => Number(v) },
  { key: "valkey.password", envName: "VALKEY_PASSWORD", parse: (v) => v },
  { key: "valkey.db", envName: "VALKEY_DB", parse: (v) => Number(v) },
  { key: "valkey.connect_timeout", envName: "VALKEY_CONNECT_TIMEOUT", parse: (v) => v },
  // otel
  { key: "otel.exporter", envName: "OTEL_EXPORTER", parse: (v) => v },
  { key: "otel.endpoint", envName: "OTEL_EXPORTER_OTLP_ENDPOINT", parse: (v) => v },
  { key: "otel.service_name", envName: "OTEL_SERVICE_NAME", parse: (v) => v },
  { key: "otel.sampling", envName: "OTEL_TRACES_SAMPLER_ARG", parse: (v) => Number(v) },
  // log
  { key: "log.level", envName: "LOG_LEVEL", parse: (v) => v },
  { key: "log.format", envName: "LOG_FORMAT", parse: (v) => v },
  // example
  { key: "example.enabled", envName: "EXAMPLE_ENABLED", parse: (v) => v === "true" || v === "1" },
  {
    key: "example.default_page_size",
    envName: "EXAMPLE_DEFAULT_PAGE_SIZE",
    parse: (v) => Number(v),
  },
  { key: "example.max_page_size", envName: "EXAMPLE_MAX_PAGE_SIZE", parse: (v) => Number(v) },
  { key: "example.max_name_length", envName: "EXAMPLE_MAX_NAME_LENGTH", parse: (v) => Number(v) },
];

// ---------- merging -----------------------------------------------------------

/** Deep-merge `overrides` into `base`. Arrays and primitives are replaced, not merged. */
function deepMerge<T extends Record<string, unknown>>(base: T, overrides: T): T {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) continue;
    const baseVal = out[k];
    if (
      v !== null &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      baseVal !== null &&
      typeof baseVal === "object" &&
      !Array.isArray(baseVal)
    ) {
      out[k] = deepMerge(baseVal as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

function setPath(obj: Record<string, unknown>, dottedKey: string, value: unknown): void {
  const parts = dottedKey.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const seg = parts[i] as string;
    const next = cur[seg];
    if (next === null || typeof next !== "object" || Array.isArray(next)) {
      const fresh: Record<string, unknown> = {};
      cur[seg] = fresh;
      cur = fresh;
    } else {
      cur = next as Record<string, unknown>;
    }
  }
  cur[parts[parts.length - 1] as string] = value;
}

// ---------- public API --------------------------------------------------------

/** Minimal file-shape we accept from YAML; deeper validation happens in Zod. */
type ConfigFile = Record<string, Record<string, unknown>>;

/** Load and validate configuration. Throws `ConfigError` on any failure. */
export function loadConfig(): Config {
  const filePath =
    process.env.CONFIG_FILE && process.env.CONFIG_FILE.length > 0
      ? resolvePath(process.env.CONFIG_FILE)
      : resolvePath("config.yaml");

  const fileConfig = readConfigFile(filePath);

  // Env overrides: env wins over file.
  const envOverrides: Record<string, unknown> = {};
  for (const binding of LEAF_BINDINGS) {
    const raw = process.env[binding.envName];
    if (raw === undefined) continue;
    setPath(envOverrides, binding.key, binding.parse(raw));
  }

  // Ensure every top-level section exists so Zod's per-field defaults can
  // cascade when a section is missing from both the file and env.
  const TOP_LEVEL_KEYS = ["app", "http", "db", "valkey", "otel", "log", "example"] as const;
  for (const k of TOP_LEVEL_KEYS) {
    if (!(k in fileConfig)) fileConfig[k] = {};
  }

  const merged = deepMerge(fileConfig, envOverrides);

  let parsed: Config;
  try {
    parsed = ConfigSchema.parse(merged);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new ConfigError(formatZodError(err), { cause: err });
    }
    throw new ConfigError("config validation failed", { cause: err });
  }

  // Cross-section validation.
  validateCrossSection(parsed);

  return parsed;
}

function readConfigFile(path: string): ConfigFile {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    if (isNotFound(err)) {
      return {};
    }
    throw new ConfigError(`read config file ${path}: ${(err as Error).message}`, { cause: err });
  }
  const parsed = YAML.parse(raw);
  if (parsed === null || parsed === undefined) {
    return {};
  }
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ConfigError(`config file ${path} must be a YAML mapping at the top level`);
  }
  return parsed as ConfigFile;
}

function isNotFound(err: unknown): boolean {
  return Boolean(
    err && typeof err === "object" && "code" in err && (err as { code: string }).code === "ENOENT",
  );
}

function formatZodError(err: z.ZodError): string {
  const issues = err.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  return `config validation failed:\n${issues}`;
}

function validateCrossSection(cfg: Config): void {
  if (cfg.otel.exporter === "otlp") {
    if (cfg.otel.endpoint.trim().length === 0) {
      throw new ConfigError("OTEL_EXPORTER_OTLP_ENDPOINT is required when OTEL_EXPORTER=otlp");
    }
    try {
      // eslint-disable-next-line no-new
      new URL(cfg.otel.endpoint);
    } catch (err) {
      throw new ConfigError(
        `OTEL_EXPORTER_OTLP_ENDPOINT is not a valid URL: ${cfg.otel.endpoint}`,
        { cause: err },
      );
    }
  }
  if (cfg.db.max_conns < cfg.db.min_conns) {
    throw new ConfigError("DB_MAX_CONNS must be >= DB_MIN_CONNS");
  }
}

// ---------- helpers on resolved Config ---------------------------------------

export function httpAddr(cfg: Config): string {
  return `${cfg.http.host}:${cfg.http.port}`;
}

export function dbConnString(cfg: Config): string {
  // Encode the user/password before constructing the URL so that special
  // characters in the password (e.g. `@`, `/`, `?`, `#`) don't terminate
  // the userinfo/host/path/query/fragment segments.
  const userInfo = `${encodeURIComponent(cfg.db.user)}:${encodeURIComponent(cfg.db.password)}`;
  const u = new URL(`postgres://${userInfo}@${cfg.db.host}:${cfg.db.port}/${cfg.db.name}`);
  u.searchParams.set("sslmode", cfg.db.ssl_mode);
  return u.toString();
}

export function valkeyAddr(cfg: Config): string {
  return `${cfg.valkey.host}:${cfg.valkey.port}`;
}
