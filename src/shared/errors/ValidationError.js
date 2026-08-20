import ApiError from './ApiError.js';

export class ValidationError extends ApiError {
  constructor(message = 'Error de validación', details = null) {
    super(400, message, details, 'VALIDATION_ERROR');
  }
}