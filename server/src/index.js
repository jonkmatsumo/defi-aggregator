import dotenv from 'dotenv';
import { createServer } from './server.js';
import { logger } from './utils/logger.js';
import { validateConfig } from './config/environment.js';

// Load environment variables
dotenv.config();

async function startServer() {
  try {
    // Validate configuration
    const config = validateConfig();

    // Create and start server
    const server = await createServer(config);

    const port = config.port;
    const host = config.host;

    server.listen(port, host, () => {
      logger.info('GenAI Server started successfully', {
        port,
        host,
        environment: config.nodeEnv,
        llmProvider: config.llm.provider,
      });
    });

    // Graceful shutdown handling
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Start the server
startServer();
