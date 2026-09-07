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

    // Escribir de vuelta los valores transformados/coercidos por Zod
    // (defaults, coerce a número/boolean, transforms) para que el servicio
    // reciba datos ya normalizados en req.body / req.query / req.params.
    const sections = schema.shape ?? {};
    for (const section of Object.keys(sections)) {
      if (Object.prototype.hasOwnProperty.call(result.data, section) && result.data[section] !== undefined) {
        const value = result.data[section];
        if (section === 'query' || section === 'params') {
          // Express define req.query y req.params como getters de solo lectura.
          // Mutamos el objeto existente en lugar de reasignar la propiedad.
          for (const key of Object.keys(req[section])) {
            delete req[section][key];
          }
          Object.assign(req[section], value);
        } else {
          req[section] = value;
        }
      }
    }

    next();
  };
};
