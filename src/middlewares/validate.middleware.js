import { ApiError } from '../shared/errors/ApiError.js';
import { TokenExpiredError } from '../shared/errors/TokenExpiredError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

/**
 * Devuelve un middleware que valida req.body/req.query/req.params con el schema dado.
 * Si falla, delega al errorHandler global con un AppError que incluye details por campo.
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
        new ApiError({
          message: 'Los datos enviados no son válidos',
          code: TokenExpiredError.VALIDATION_ERROR,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          details,
        }),
      );
    }

    next();
  };
};
