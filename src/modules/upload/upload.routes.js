import { Router } from 'express';
import { uploadMiddleware } from '../../middlewares/upload.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import env from '../../config/env.js';

const router = Router();

// POST /api/upload
// Requiere autenticación. Acepta un campo form-data llamado 'file'.
router.post('/', authenticate, uploadMiddleware.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No se subió ningún archivo',
    });
  }

  // Construimos la URL pública para el frontend
  // Ej: http://localhost:3000/uploads/file-123.jpg
  const fileUrl = `${env.APP_URL}/uploads/${req.file.filename}`;

  res.status(201).json({
    success: true,
    message: 'Archivo subido correctamente',
    data: {
      url: fileUrl,
      mimetype: req.file.mimetype,
      size: req.file.size,
    },
  });
});

export default router;

