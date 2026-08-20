/**
 * @file asyncHandler.js
 * @description Wrapper para funciones asíncronas en controllers de Express.
 * 
 * Express NO captura errores en funciones async automáticamente.
 * Este wrapper envuelve la función y pasa cualquier error al middleware
 * de manejo de errores mediante next(error).
 * 
 * @example
 * // SIN asyncHandler (peligroso - el error no se captura):
 * const getUser = async (req, res) => {
 *   const user = await userService.findById(req.params.id); // Si falla, el servidor cuelga
 *   res.json(user);
 * };
 * 
 * // CON asyncHandler (seguro - el error se captura):
 * const getUser = asyncHandler(async (req, res) => {
 *   const user = await userService.findById(req.params.id); // Si falla, va al errorHandler
 *   res.json(user);
 * });
 */

/**
 * Envuelve una función asíncrona de Express para capturar errores automáticamente.
 * 
 * @param {Function} fn - Función asíncrona del controller (req, res, next) => Promise
 * @returns {Function} Función compatible con Express que captura errores
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;