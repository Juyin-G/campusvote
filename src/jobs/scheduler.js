// const cron = require('node-cron');
// const { runBackupJob } = require('./backup');
// const { cleanupExpiredTokens } = require('./cleanup'); // Tu función SQL

// // Backup diario a las 2 AM
// cron.schedule('0 2 * * *', async () => {
//   console.log('🕐 Ejecutando backup diario...');
//   await runBackupJob();
// });

// // Limpieza de tokens cada hora
// cron.schedule('0 * * * *', async () => {
//   await cleanupExpiredTokens();
// });