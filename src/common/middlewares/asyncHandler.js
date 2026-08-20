/**
 * Envuelve un controller async para que cualquier rechazo
 * (incluido un AppError) se propague al errorHandler global.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
