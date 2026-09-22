/**
 * @file ApiError.js
 * @description Clase de error personalizada para la API CampusVote
 * @see S0-01 - Sprint 0
 */

export class ApiError extends Error {
  /**
   * @param {number} statusCode - Código HTTP del error
   * @param {string} message - Mensaje del error
   * @param {any} [details] - Detalles adicionales del error
   * @param {string} [code] - Código interno del error (para frontend)
   */
  constructor(statusCode, message, details = null, code = null) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // MÉTODOS ESTÁTICOS - Errores comunes

  static badRequest(message = 'Bad Request', details = null) {
    return new ApiError(400, message, details, 'BAD_REQUEST');
  }

  static unauthorized(message = 'Unauthorized', details = null) {
    return new ApiError(401, message, details, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Forbidden', details = null) {
    return new ApiError(403, message, details, 'FORBIDDEN');
  }

  static notFound(message = 'Resource not found', details = null) {
    return new ApiError(404, message, details, 'NOT_FOUND');
  }

  static conflict(message = 'Conflict', details = null) {
    return new ApiError(409, message, details, 'CONFLICT');
  }

  static unprocessable(message = 'Unprocessable Entity', details = null) {
    return new ApiError(422, message, details, 'UNPROCESSABLE_ENTITY');
  }

  static tooManyRequests(message = 'Too many requests', details = null, code = 'TOO_MANY_REQUESTS') {
    return new ApiError(429, message, details, code);
  }

  static internal(message = 'Internal Server Error', details = null) {
    return new ApiError(500, message, details, 'INTERNAL_SERVER_ERROR');
  }

  static serviceUnavailable(message = 'Service Unavailable', details = null, code = 'SERVICE_UNAVAILABLE') {
    return new ApiError(503, message, details, code);
  }

  // MÉTODOS ESTÁTICOS - Errores específicos de CampusVote

  static invalidCredentials() {
    return new ApiError(401, 'Invalid credentials', null, 'INVALID_CREDENTIALS');
  }

  static invalidToken(message = 'Invalid or expired token') {
    return new ApiError(401, message, null, 'INVALID_TOKEN');
  }

  static accountLocked(lockUntil = null) {
    return new ApiError(423, 'Account is temporarily locked', { lockUntil }, 'ACCOUNT_LOCKED');
  }

  static accountNotVerified() {
    return new ApiError(403, 'Account is not verified', null, 'ACCOUNT_NOT_VERIFIED');
  }

  static userAlreadyExists(field = 'email') {
    return new ApiError(409, `A user with this ${field} already exists`, { field }, 'USER_ALREADY_EXISTS');
  }

  static invalidDigitalSignature() {
    return new ApiError(422, 'Invalid digital signature', null, 'INVALID_DIGITAL_SIGNATURE');
  }

  static emailAuthFailed(message = 'Email authentication failed', details = null) {
    return new ApiError(503, message, details, 'EMAIL_AUTH_FAILED');
  }

  static emailRateLimited(message = 'Email rate limit exceeded', details = null) {
    return new ApiError(429, message, details, 'EMAIL_RATE_LIMITED');
  }

  // UTILIDADES

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code || 'UNKNOWN_ERROR',
        message: this.message,
        details: this.details,
        timestamp: this.timestamp,
      },
    };
  }

  static fromError(error) {
    if (error instanceof ApiError) {
      return error;
    }

    // Manejo de errores de validación de Zod
    if (error.name === 'ZodError') {
      const formattedDetails = error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return ApiError.unprocessable('Validation Error', formattedDetails);
    }

    // Prisma: Restricción de duplicados (Unique constraint)
    if (error.code === 'P2002') {
      return ApiError.conflict('A record with this value already exists', {
        target: error.meta?.target,
      });
    }

    // Prisma: Registro no encontrado
    if (error.code === 'P2025') {
      return ApiError.notFound('Record not found');
    }

    // Prisma: Clave foránea no válida
    if (error.code === 'P2003') {
      return ApiError.badRequest('Referenced resource does not exist', {
        field: error.meta?.field_name,
      });
    }

    return new ApiError(
      500,
      error.message || 'Internal Server Error',
      null,
      'INTERNAL_SERVER_ERROR'
    );
  }
}

export default ApiError;