/**
 * @file notFoundHandler.js
 * @description Middleware para manejar rutas no encontradas (404)
 */

import ApiError from '../shared/errors/ApiError.js';

/**
 * Captura peticiones a endpoints no registrados y pasa el error alerrorHandler global.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const notFoundHandler = (req, res, next) => {
  const error = new ApiError(
    404,
    `La ruta ${req.method} ${req.originalUrl} no fue encontrada`,
    null,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

export default notFoundHandler;