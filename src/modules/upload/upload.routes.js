import { Router } from 'express';
import fs from 'node:fs/promises';
import { uploadMiddleware } from '../../middlewares/upload.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import env from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { hasValidSignature } from '../../shared/utils/fileSignature.js';
import logger from '../../config/logger.js';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

const getBucket = () => {
  if (env.UPLOAD_STORAGE_DRIVER !== 'firebase') return null;
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY || !env.FIREBASE_STORAGE_BUCKET) {
    throw new Error('La configuración de Firebase Storage está incompleta');
  }
  const app = getApps()[0] || initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    storageBucket: env.FIREBASE_STORAGE_BUCKET,
  });
  return getStorage(app).bucket(env.FIREBASE_STORAGE_BUCKET);
};

const router = Router();

// POST /api/upload
// Requiere autenticación. Acepta form-data con campo 'file' (1..N según env).
router.post(
  '/',
  authenticate,
  uploadMiddleware.array('file', env.UPLOAD_MAX_FILES),
  async (req, res) => {
    const files = Array.isArray(req.files) ? req.files : [];

    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se subió ningún archivo',
      });
    }

    // Verificación de contenido REAL (magic bytes): el MIME declarado no basta.
    for (const file of files) {
      try {
        const valid = await hasValidSignature(file.path, file.mimetype);
        if (!valid) {
          // Multer supplies this path from the configured upload directory.
          // eslint-disable-next-line security/detect-non-literal-fs-filename
          await fs.unlink(file.path).catch(() => {});
          return res.status(400).json({
            success: false,
            message: `El archivo "${file.originalname}" no coincide con su tipo declarado.`,
          });
        }
      } catch (err) {
        logger.error('Error verificando firma del archivo:', err);
        return res.status(500).json({
          success: false,
          message: 'No se pudo verificar el contenido del archivo',
        });
      }
    }

    try {
      const records = [];
      for (const file of files) {
        // Construimos la URL pública para el frontend
        const fileUrl = `${env.APP_URL}/uploads/${file.filename}`;
        records.push(
          await prisma.media_files.create({
            data: {
              user_id: req.user.id,
              filename: file.filename,
              original_name: file.originalname,
              mime_type: file.mimetype,
              size_bytes: file.size,
              url: fileUrl,
            },
          })
        );
      }

      return res.status(201).json({
        success: true,
        message: 'Archivo(s) subido(s) correctamente',
        data: {
          files: records.map((r) => ({
            url: r.url,
            mimetype: r.mime_type,
            size: r.size_bytes,
          })),
        },
      });
    } catch (error) {
      logger.error('Error al guardar el registro de Media:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al registrar el archivo en la base de datos',
      });
    }
  }
);

export default router;
