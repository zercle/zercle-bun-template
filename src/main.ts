import { loadConfig } from './infrastructure/config/config.js';
import { App } from './app.js';
import 'dotenv/config';

async function main() {
  try {
    // Load configuration
    const config = loadConfig();

    // Create and start application
    const app = new App(config);
    await app.start();

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM signal received');
      await app.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT signal received');
      await app.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

main();
