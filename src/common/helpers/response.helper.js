import { randomUUID } from 'node:crypto';

/**
 * Genera un requestId legible para correlación humana en logs.
 */
export const generateRequestId = () => {
  const ts = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+|T/, '')
    .slice(0, 15);
  const rand = randomUUID().split('-')[0];
  return `req-${ts}-${rand}`;
};

/**
 * Helpers de respuesta estandarizados.
 * Mantienen el contrato: { success, message, data, requestId } o { success, error, requestId }.
 */
export const ok = (res, { status = 200, message, data = null, requestId }) => {
  return res.status(status).json({
    success: true,
    message,
    data,
    requestId,
  });
};

export const fail = (res, { status, code, message, details, requestId }) => {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details && details.length > 0 && { details }),
    },
    requestId,
  });
};
