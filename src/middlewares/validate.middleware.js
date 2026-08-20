import { AppError } from '../common/errors/AppError.js';
import { ErrorCodes } from '../common/errors/errorCodes.js';
import { HttpStatus } from '../common/errors/httpStatus.js';

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
        new AppError({
          message: 'Los datos enviados no son válidos',
          code: ErrorCodes.VALIDATION_ERROR,
          statusCode: HttpStatus.BAD_REQUEST,
          details,
        }),
      );
    }

    next();
  };
};
