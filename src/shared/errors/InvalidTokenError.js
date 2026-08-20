import ApiError from './ApiError.js';

export class InvalidTokenError extends ApiError {
  constructor(message = 'Token inválido') {
    super(401, message, null, 'INVALID_TOKEN');
  }
}