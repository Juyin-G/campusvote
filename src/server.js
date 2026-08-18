import app from './app.js';
import env from './config/env.js';
import logger from './config/logger.js';

const PORT = env.PORT;

app.listen(PORT, () => {
  logger.info(`CampusVote API server started`, {
    port: PORT,
    env: env.NODE_ENV,
    docs: `http://localhost:${PORT}/api-docs`
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});