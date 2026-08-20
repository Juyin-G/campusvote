import ApiError from './ApiError.js';

export class AuthenticationError extends ApiError {
  constructor(message = 'Credenciales inválidas', details = null) {
    super(401, message, details, 'AUTHENTICATION_ERROR');
  }
}