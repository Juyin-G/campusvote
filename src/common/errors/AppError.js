/**
 * AppError: clase de error operacional con metadatos HTTP.
 *
 * Cualquier código que lance un error esperado al cliente debe usar este tipo.
 * Errores que no sean AppError se consideran bugs y caen como 500.
 */
export class AppError extends Error {
  constructor({ message, code, statusCode, details }) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}
