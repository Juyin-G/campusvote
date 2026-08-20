import ApiError from './ApiError.js';

export class TokenExpiredError extends ApiError {
  constructor(message = 'El token ha expirado') {
    super(401, message, null, 'TOKEN_EXPIRED');
  }
}