import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import env from '../config/env.js';
import { ApiError } from '../shared/errors/ApiError.js';
import { isAllowedMimeType } from '../shared/utils/fileSignature.js';

// Directorio destino
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

// Límites configurables por entorno (env.js): tamaño por archivo y cantidad.
const MAX_FILE_SIZE = env.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_FILES = env.UPLOAD_MAX_FILES;

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

// Filtro estricto de seguridad (MIME types permitidos).
// El contenido real se verifica por magic bytes en la ruta (upload.routes.js).
const fileFilter = (req, file, cb) => {
  if (isAllowedMimeType(file.mimetype)) {
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
    fileSize: MAX_FILE_SIZE, // Límite por archivo (env.UPLOAD_MAX_FILE_SIZE_MB)
    files: MAX_FILES, // Máximo número de archivos por petición (env.UPLOAD_MAX_FILES)
  },
});

export default uploadMiddleware;