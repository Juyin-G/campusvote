// const { exec } = require('child_process');
// const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
// const path = require('path');
// const fs = require('fs');
// const logger = require('../config/logger');

// const s3 = new S3Client({
//   region: process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY,
//     secretAccessKey: process.env.AWS_SECRET_KEY,
//   },
// });

// async function createBackup() {
//   const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
//   const filename = `backup_${timestamp}.sql`;
//   const filepath = path.join('/tmp', filename);

//   const command = `pg_dump -h ${process.env.DB_HOST} -U ${process.env.DB_USER} -d ${process.env.DB_NAME} -F c -b -v -f ${filepath}`;

//   return new Promise((resolve, reject) => {
//     exec(command, { env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD } }, (error, stdout, stderr) => {
//       if (error) {
//         logger.error('Error en backup:', error);
//         return reject(error);
//       }
//       logger.info(`Backup creado: ${filename}`);
//       resolve(filepath);
//     });
//   });
// }

// async function uploadToS3(filepath) {
//   const filename = path.basename(filepath);
//   const fileStream = fs.createReadStream(filepath);

//   const command = new PutObjectCommand({
//     Bucket: process.env.AWS_BACKUP_BUCKET,
//     Key: `backups/${filename}`,
//     Body: fileStream,
//     ServerSideEncryption: 'AES256',
//   });

//   await s3.send(command);
//   logger.info(`Backup subido a S3: ${filename}`);
  
//   // Limpiar archivo local
//   fs.unlinkSync(filepath);
// }

// async function runBackupJob() {
//   try {
//     const filepath = await createBackup();
//     await uploadToS3(filepath);
//     logger.info('Backup completado exitosamente');
//   } catch (error) {
//     logger.error('Error en el backup job:', error);
//   }
// }

// module.exports = { runBackupJob };