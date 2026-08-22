import { ApiError } from '../shared/errors/ApiError.js';

/**
 * Devuelve un middleware que valida req.body/req.query/req.params con el schema dado.
 * Si falla, delega al errorHandler global con un ApiError que incluye details por campo.
 */
export const validate = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      return next(
        ApiError.badRequest('Los datos enviados no son válidos', details)
      );
    }

    next();
  };
};
