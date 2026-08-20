/**
 * @file index.js
 * @description Export centralizado de todos los tipos de error de la API
 * @module shared/errors
 */

// ERROR BASE

export { default as ApiError } from './ApiError.js';

// ERRORES DE AUTENTICACIÓN

export { AuthenticationError } from './AuthenticationError.js';
export { TokenExpiredError } from './TokenExpiredError.js';
export { InvalidTokenError } from './InvalidTokenError.js';

// ERRORES DE VALIDACIÓN

export { ValidationError } from './ValidationError.js';

// ERRORES DE RECURSOS

export { NotFoundError } from './NotFoundError.js';
export { ConflictError } from './ConflictError.js';

// ERRORES DE PERMISOS

export { ForbiddenError } from './ForbiddenError.js';