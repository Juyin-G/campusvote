import ApiError from './ApiError.js';

export class NotFoundError extends ApiError {
  constructor(resource = 'Recurso', id = null) {
    const message = id 
      ? `${resource} con ID ${id} no encontrado` 
      : `${resource} no encontrado`;
    super(404, message, { resource, id }, 'NOT_FOUND');
  }
}