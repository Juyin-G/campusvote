import ApiError from './ApiError.js';

export class ConflictError extends ApiError {
  constructor(message = 'Conflicto con el estado actual', details = null) {
    super(409, message, details, 'CONFLICT');
  }
}