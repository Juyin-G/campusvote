import { Router } from 'express';
import { uploadMiddleware } from '../../middlewares/upload.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import env from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import logger from '../../config/logger.js';

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

  // Construimos la URL pública para el frontend
  // Ej: http://localhost:3000/uploads/file-123.jpg
  const fileUrl = `${env.APP_URL}/uploads/${req.file.filename}`;

  try {
    // Guardamos el registro en la base de datos (Modelo Media)
    await prisma.media_files.create({
      data: {
        user_id: req.user.userId, // El usuario autenticado que subió el archivo
        filename: req.file.filename,
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
