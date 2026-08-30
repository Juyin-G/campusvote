import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { ApiError } from '../shared/errors/ApiError.js';

// Directorio destino
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

// Configuración del almacenamiento en disco local
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Generamos un nombre seguro para evitar Path Traversal y sobreescrituras
    const uniqueSuffix = crypto.randomUUID();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// Filtro estricto de seguridad (MIME types permitidos)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf' // Útil para Planes de Gobierno o Pósters de Feria
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      ApiError.badRequest(
        'Tipo de archivo no permitido. Solo se aceptan JPG, PNG, WEBP y PDF.'
      ),
      false
    );
  }
};

// Middleware configurado
export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB máximo para evitar DoS (Denial of Service)
    files: 3, // Máximo 3 archivos a la vez
  },
});

