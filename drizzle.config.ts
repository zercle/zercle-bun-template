import type { Config } from 'drizzle-kit';
import { loadConfig } from './src/config/config';
import { dbConnString } from './src/config/config';

const cfg = loadConfig();

export default {
  schema: './src/internal/infrastructure/db/drizzle/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: dbConnString(cfg),
  },
} satisfies Config;
