import { Router } from 'express';
import fs from 'node:fs/promises';
import { uploadMiddleware } from '../../middlewares/upload.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import env from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { hasValidSignature } from '../../shared/utils/fileSignature.js';
import logger from '../../config/logger.js';

const router = Router();

// POST /api/upload/
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

// POST /api/upload/logo
// Específico para logos institucionales. Acepta form-data con campo 'logo'.
// Solo ADMIN/SUPERADMIN autenticados. Devuelve la URL pública persistida.
router.post(
  '/logo',
  authenticate,
  uploadMiddleware.single('logo'),
  async (req, res) => {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No se subió ningún archivo (campo "logo" esperado)',
      });
    }

    // Solo permitimos imágenes para logos (alineado con fileSignature.MAGIC).
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      await fs.unlink(file.path).catch(() => {});
      return res.status(400).json({
        success: false,
        message: 'Formato no soportado. Usa PNG, JPG o WEBP.',
      });
    }

    try {
      const valid = await hasValidSignature(file.path, file.mimetype);
      if (!valid) {
        await fs.unlink(file.path).catch(() => {});
        return res.status(400).json({
          success: false,
          message: `El archivo "${file.originalname}" no coincide con su tipo declarado.`,
        });
      }
    } catch (err) {
      logger.error('Error verificando firma del logo:', err);
      return res.status(500).json({
        success: false,
        message: 'No se pudo verificar el contenido del archivo',
      });
    }

    try {
      const fileUrl = `${env.APP_URL}/uploads/${file.filename}`;
      const record = await prisma.media_files.create({
        data: {
          user_id: req.user.id,
          filename: file.filename,
          original_name: file.originalname,
          mime_type: file.mimetype,
          size_bytes: file.size,
          url: fileUrl,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Logo subido correctamente',
        data: {
          url: record.url,
          mimetype: record.mime_type,
          size: record.size_bytes,
        },
      });
    } catch (error) {
      logger.error('Error al guardar el logo:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al registrar el logo en la base de datos',
      });
    }
  }
);

export default router;