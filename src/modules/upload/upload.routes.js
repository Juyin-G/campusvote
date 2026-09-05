import { Router } from 'express';
import { uploadMiddleware } from '../../middlewares/upload.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import env from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import logger from '../../config/logger.js';
import crypto from 'node:crypto';
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
// Requiere autenticación. Acepta un campo form-data llamado 'file'.
router.post('/', authenticate, uploadMiddleware.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No se subió ningún archivo',
    });
  }

  try {
    let fileName = req.file.filename;
    let fileUrl;
    if (env.UPLOAD_STORAGE_DRIVER === 'firebase') {
      fileName = `uploads/${req.user.userId}/${crypto.randomUUID()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const file = getBucket().file(fileName);
      await file.save(req.file.buffer, { metadata: { contentType: req.file.mimetype } });
      [fileUrl] = await file.getSignedUrl({ action: 'read', expires: '01-01-2036' });
    } else {
      fileUrl = `${env.APP_URL}/uploads/${req.file.filename}`;
    }

    // Guardamos el registro en la base de datos (Modelo Media)
    await prisma.media_files.create({
      data: {
        user_id: req.user.userId, // El usuario autenticado que subió el archivo
        filename: fileName,
        original_name: req.file.originalname,
        mime_type: req.file.mimetype,
        size_bytes: req.file.size,
        url: fileUrl,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Archivo subido correctamente',
      data: {
        url: fileUrl,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (error) {
    logger.error('Error al guardar el registro de Media:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar el archivo en la base de datos',
    });
  }
});

export default router;
