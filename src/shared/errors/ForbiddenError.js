import ApiError from './ApiError.js';

export class ForbiddenError extends ApiError {
  constructor(message = 'No tienes permisos para realizar esta acción') {
    super(403, message, null, 'FORBIDDEN');
  }
}