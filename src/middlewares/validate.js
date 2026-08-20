import { z } from 'zod';

/**
 * Middleware de validación genérico con Zod
 * Soporta validación de body, query, params y headers
 */
export const validate = (schemas) => {
  return async (req, res, next) => {
    try {
      // Validar body si existe schema
      if (schemas.body) {
        const bodyResult = await schemas.body.safeParseAsync(req.body);
        if (!bodyResult.success) {
          return formatErrorResponse(res, bodyResult.error, 'body');
        }
        req.body = bodyResult.data;
      }

      // Validar query params si existe schema
      if (schemas.query) {
        const queryResult = await schemas.query.safeParseAsync(req.query);
        if (!queryResult.success) {
          return formatErrorResponse(res, queryResult.error, 'query');
        }
        req.query = queryResult.data;
      }

      // Validar URL params si existe schema
      if (schemas.params) {
        const paramsResult = await schemas.params.safeParseAsync(req.params);
        if (!paramsResult.success) {
          return formatErrorResponse(res, paramsResult.error, 'params');
        }
        req.params = paramsResult.data;
      }

      // Validar headers si existe schema
      if (schemas.headers) {
        const headersResult = await schemas.headers.safeParseAsync(req.headers);
        if (!headersResult.success) {
          return formatErrorResponse(res, headersResult.error, 'headers');
        }
        req.headers = headersResult.data;
      }

      next();
    } catch (error) {
      console.error('Error en middleware de validación:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno durante la validación',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
};

/**
 * Formatea los errores de Zod en una respuesta consistente
 */
const formatErrorResponse = (res, error, source) => {
  const formattedErrors = error.errors.map(err => {
    const path = err.path.join('.');
    return {
      field: path || source,
      message: err.message,
      code: err.code,
      ...(err.expected && { expected: err.expected }),
      ...(err.received !== undefined && { received: err.received })
    };
  });

  return res.status(400).json({
    success: false,
    message: 'Error de validación',
    source,
    errors: formattedErrors,
    timestamp: new Date().toISOString()
  });
};

// Helpers simplificados
export const validateBody = (schema) => validate({ body: schema });
export const validateQuery = (schema) => validate({ query: schema });
export const validateParams = (schema) => validate({ params: schema });
export const validateHeaders = (schema) => validate({ headers: schema });

// Schemas reutilizables
export const uuidSchema = z.string().uuid('El ID debe ser un UUID válido');

export const paginationSchema = z.object({
  page: z.coerce.number().min(1, 'La página debe ser mayor a 0').default(1),
  limit: z.coerce.number().min(1).max(100, 'El límite no puede exceder 100').default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const dateFilterSchema = z.object({
  startDate: z.string().datetime({ message: 'Formato de fecha inválido' }).optional(),
  endDate: z.string().datetime({ message: 'Formato de fecha inválido' }).optional()
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  {
    message: 'La fecha de inicio debe ser anterior a la fecha de fin',
    path: ['startDate']
  }
);

export default validate;