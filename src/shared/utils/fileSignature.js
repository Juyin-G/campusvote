// src/shared/utils/fileSignature.js
// Verificación de contenido real (magic bytes) de archivos subidos.
// La validación por MIME de cabecera es insuficiente: un atacante puede
// declarar image/png y subir HTML/script. Aquí se comprueba la firma.

import fs from 'node:fs/promises';

const MAGIC = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/webp': [
    [0x52, 0x49, 0x46, 0x46], // "RIFF" + "WEBP" en bytes 8-11
  ],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // "%PDF"
};

const startsWith = (buffer, signature) =>
  signature.every((byte, i) => buffer[i] === byte);

/**
 * Valida la firma del archivo contra el MIME declarado.
 * @param {string} filePath ruta absoluta del archivo guardado
 * @param {string} mimeType MIME declarado por el cliente
 * @returns {Promise<boolean>}
 */
export const hasValidSignature = async (filePath, mimeType) => {
  const signatures = MAGIC[mimeType];
  if (!signatures) return false;

  // The path is created by Multer in the configured upload directory.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const handle = await fs.open(filePath, 'r');
  try {
    // Leemos los primeros 16 bytes (suficiente para JPEG/PNG/PDF/webp).
    const { bytesRead, buffer } = await handle.read(
      Buffer.alloc(16),
      0,
      16,
      0
    );
    if (bytesRead < 4) return false; // Archivo demasiado corto
    return signatures.some((sig) => startsWith(buffer, sig));
  } finally {
    await handle.close();
  }
};

export const isAllowedMimeType = (mimeType) => Object.prototype.hasOwnProperty.call(MAGIC, mimeType);

export default { hasValidSignature, isAllowedMimeType };