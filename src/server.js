// src/server.js
import app from './app.js';
import env from './config/env.js';
import logger from './config/logger.js';
// import { prisma } from './config/db.js'; // O tu cliente de base de datos

const PORT = env.PORT || 3000;
let isShuttingDown = false; // Bandera para prevenir ejecuciones múltiples

const server = app.listen(PORT, () => {
  logger.info('CampusVote API server started', {
    category: 'SERVER',
    port: PORT,
    env: env.NODE_ENV,
    docs: `http://localhost:${PORT}/api-docs`,
  });
});

const shutdown = async (signal) => {
  // Evitar ejecuciones simultáneas
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`${signal} recibido, iniciando apagado gradual...`, { category: 'SERVER' });

  // Temporizador de desconexión forzada
  const forceExitTimer = setTimeout(() => {
    logger.error('Forzando apagado por tiempo de espera agotado', { category: 'SERVER' });
    process.exit(1);
  }, 10000);
  
  forceExitTimer.unref(); // Permite liberar el event loop si el proceso concluye antes

  try {
    // 1. Destruir conexiones HTTP inactivas (Node.js 18.2+)
    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }

    // 2. Cerrar servidor HTTP de forma asíncrona
    await new Promise((resolve) => server.close(resolve));
    logger.info('Servidor HTTP cerrado correctamente.', { category: 'SERVER' });

    // 3. Desconectar servicios externos (Base de Datos, Redis, etc.)
    // await prisma.$disconnect();
    // logger.info('Conexión a la base de datos cerrada.', { category: 'SERVER' });

    process.exit(0);
  } catch (error) {
    logger.error('Error durante el proceso de apagado:', {
      category: 'SERVER',
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

// Captura de señales del OS
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Captura de errores globales del proceso
process.on('uncaughtException', (error) => {
  logger.error('Excepción no capturada (Uncaught Exception):', {
    category: 'SERVER',
    message: error.message,
    stack: error.stack,
  });
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Promesa rechazada no manejada (Unhandled Rejection):', {
    category: 'SERVER',
    reason: reason instanceof Error ? reason.stack : reason,
  });
  shutdown('UNHANDLED_REJECTION');
});