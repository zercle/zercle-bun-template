/**
 * Integration Test Setup Utilities
 * 
 * Provides database connection, migration, seeding, and cleanup utilities
 * for integration tests with real PostgreSQL database.
 */

import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load test environment variables
config({ path: '.env.test' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration from environment
export const testDbConfig = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  user: process.env.DATABASE_USER || 'test_user',
  password: process.env.DATABASE_PASSWORD || 'test_password',
  dbname: process.env.DATABASE_NAME || 'test_db',
  max_conns: parseInt(process.env.DATABASE_MAX_CONNS || '5', 10),
  min_conns: parseInt(process.env.DATABASE_MIN_CONNS || '1', 10),
  max_conn_lifetime: process.env.DATABASE_MAX_CONN_LIFETIME || '5m',
  max_conn_idletime: process.env.DATABASE_MAX_CONN_IDLETIME || '1m',
  health_check_period: process.env.DATABASE_HEALTH_CHECK_PERIOD || '30s',
};

/**
 * Create a test database connection
 */
export async function createTestConnection(): Promise<postgres.Sql> {
  const connectionString = `postgres://${testDbConfig.user}:${testDbConfig.password}@${testDbConfig.host}:${testDbConfig.port}/${testDbConfig.dbname}`;
  
  return postgres(connectionString, {
    max: testDbConfig.max_conns,
    min: testDbConfig.min_conns,
    idle_timeout: parseDuration(testDbConfig.max_conn_idletime),
    connect_timeout: parseDuration(testDbConfig.max_conn_lifetime),
  });
}

/**
 * Run migrations on test database
 */
export async function runMigrations(): Promise<void> {
  const sql = await createTestConnection();
  const db = drizzle(sql);
  
  const migrationsFolder = path.resolve(__dirname, '../../drizzle/migrations');
  
  if (!fs.existsSync(migrationsFolder)) {
    throw new Error(`Migrations folder not found: ${migrationsFolder}`);
  }
  
  await migrate(db, { migrationsFolder });
  await sql.end();
}

/**
 * Clean up all data from test database
 * WARNING: This will delete ALL data in the test database
 */
export async function cleanupDatabase(): Promise<void> {
  const sql = await createTestConnection();
  
  // Disable foreign key checks temporarily for clean truncation
  await sql`SET CONSTRAINTS ALL DEFERRED`;
  
  // Truncate all tables in correct order (respecting foreign key dependencies)
  await sql`TRUNCATE TABLE tasks CASCADE`;
  await sql`TRUNCATE TABLE users CASCADE`;
  
  await sql.end();
}

/**
 * Seed test data for User domain
 */
export async function seedTestUsers(): Promise<{ id: string; email: string; password: string }[]> {
  const sql = await createTestConnection();
  
  const testUsers = [
    {
      email: 'test1@example.com',
      password: '$argon2id$v=19$m=65536,t=3,p=1$test salt test salt test salt test salt$test hash test hash test hash test hash test hash test hash',
      full_name: 'Test User 1',
      phone: '123-456-7890',
      is_active: true,
    },
    {
      email: 'test2@example.com',
      password: '$argon2id$v=19$m=65536,t=3,p=1$another salt another salt another salt another salt$another hash another hash another hash',
      full_name: 'Test User 2',
      phone: '098-765-4321',
      is_active: true,
    },
    {
      email: 'inactive@example.com',
      password: '$argon2id$v=19$m=65536,t=3,p=1$inactive salt inactive salt inactive salt$inactive hash inactive hash inactive hash',
      full_name: 'Inactive User',
      phone: '555-555-5555',
      is_active: false,
    },
  ];
  
  const insertedUsers = await sql`
    INSERT INTO users (email, password, full_name, phone, is_active)
    VALUES ${sql(testUsers.map(u => [u.email, u.password, u.full_name, u.phone, u.is_active]))}
    RETURNING id, email, password
  `;
  
  await sql.end();
  return insertedUsers.map(u => ({ id: u.id, email: u.email, password: u.password }));
}

/**
 * Seed test data for Task domain
 */
export async function seedTestTasks(userId: string): Promise<{ id: string; title: string }[]> {
  const sql = await createTestConnection();
  
  const testTasks = [
    { user_id: userId, title: 'Test Task 1', description: 'First test task', status: 'pending', priority: 'high' },
    { user_id: userId, title: 'Test Task 2', description: 'Second test task', status: 'in_progress', priority: 'medium' },
    { user_id: userId, title: 'Test Task 3', description: 'Third test task', status: 'completed', priority: 'low' },
    { user_id: userId, title: 'Urgent Task', description: 'Urgent task to test priority', status: 'pending', priority: 'urgent' },
    { user_id: userId, title: 'Task without description', description: null, status: 'pending', priority: 'medium' },
  ];
  
  const insertedTasks = await sql`
    INSERT INTO tasks (user_id, title, description, status, priority)
    VALUES ${sql(testTasks.map(t => [t.user_id, t.title, t.description, t.status, t.priority]))}
    RETURNING id, title
  `;
  
  await sql.end();
  return insertedTasks.map(t => ({ id: t.id, title: t.title }));
}

/**
 * Delete test user by ID (and cascade delete associated tasks)
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const sql = await createTestConnection();
  await sql`DELETE FROM users WHERE id = ${userId}`;
  await sql.end();
}

/**
 * Delete test task by ID
 */
export async function deleteTestTask(taskId: string): Promise<void> {
  const sql = await createTestConnection();
  await sql`DELETE FROM tasks WHERE id = ${taskId}`;
  await sql.end();
}

/**
 * Check if test database is healthy
 */
export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    const sql = await createTestConnection();
    const result = await sql`SELECT 1 as healthy`;
    await sql.end();
    return result[0]?.healthy === 1;
  } catch {
    return false;
  }
}

/**
 * Wait for database to be ready with retries
 */
export async function waitForDatabase(maxRetries: number = 30, intervalMs: number = 1000): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    if (await isDatabaseHealthy()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return false;
}

/**
 * Parse duration string to milliseconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smh])$/);
  if (!match) {
    return 60000; // default 1 minute
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    default:
      return 60000;
  }
}

// Re-export for convenience
export { sql } from 'drizzle-orm';
