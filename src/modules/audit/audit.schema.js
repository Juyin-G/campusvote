import Joi from 'joi';

// Enum de acciones de auditoría (coincide exactamente con el ENUM SQL)
export const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  VERIFY_2FA: 'VERIFY_2FA',
  CREATE_ELECTION: 'CREATE_ELECTION',
  OPEN_ELECTION: 'OPEN_ELECTION',
  CAST_VOTE: 'CAST_VOTE',
  CLOSE_ELECTION: 'CLOSE_ELECTION',
  CERTIFY_RESULT: 'CERTIFY_RESULT',
  PUBLISH_RESULT: 'PUBLISH_RESULT'
};

// Esquema reutilizable de UUID v4
export const uuidSchema = Joi.string().uuid({ version: 'uuidv4' });

// Esquema para consultar audit logs (filtros)
export const auditLogsQuerySchema = Joi.object({
  action: Joi.string()
    .valid(...Object.values(AUDIT_ACTIONS))
    .optional()
    .description('Tipo de acción a filtrar'),
  
  electionId: uuidSchema
    .optional()
    .description('ID de la elección'),
  
  actorId: uuidSchema
    .optional()
    .description('ID del usuario que realizó la acción'),
  
  fromDate: Joi.date()
    .iso()
    .optional()
    .description('Fecha inicial del rango'),
  
  toDate: Joi.date()
    .iso()
    .optional()
    .when('fromDate', {
      is: Joi.exist(),
      then: Joi.date().greater(Joi.ref('fromDate')),
      otherwise: Joi.date()
    })
    .description('Fecha final del rango (debe ser mayor a fromDate)'),
  
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .description('Número de página'),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .description('Cantidad de registros por página')
}).with('toDate', 'fromDate');

// Esquema para crear un log de auditoría
export const createAuditLogSchema = Joi.object({
  electionId: uuidSchema
    .optional()
    .allow(null)
    .description('ID de la elección asociada'),
  
  action: Joi.string()
    .valid(...Object.values(AUDIT_ACTIONS))
    .required()
    .description('Acción a registrar'),
  
  metadata: Joi.object()
    .optional()
    .default({})
    .description('Metadatos adicionales del evento')
});

// Esquema para crear one-time token
export const createOneTimeTokenSchema = Joi.object({
  userId: uuidSchema
    .required()
    .description('ID del usuario'),
  
  electionId: uuidSchema
    .required()
    .description('ID de la elección'),
  
  expiresAt: Joi.date()
    .iso()
    .required()
    .greater('now')
    .description('Fecha de expiración del token')
});

// Esquema para consumir one-time token
export const consumeOneTimeTokenSchema = Joi.object({
  rawToken: Joi.string()
    .trim()
    .min(32)
    .max(128)
    .required()
    .description('Token en texto plano'),
  
  electionId: uuidSchema
    .required()
    .description('ID de la elección')
});

// Esquema para consultar estado de un token
export const checkTokenStatusSchema = Joi.object({
  token: Joi.string()
    .trim()
    .required()
    .description('Token en texto plano'),
  
  electionId: uuidSchema
    .required()
    .description('ID de la elección')
});

// Esquema para respuesta de audit log
export const auditLogResponseSchema = Joi.object({
  id: uuidSchema.required(),
  actorId: uuidSchema.allow(null),
  electionId: uuidSchema.allow(null),
  action: Joi.string().valid(...Object.values(AUDIT_ACTIONS)).required(),
  timestamp: Joi.date().iso().required(),
  ipAddress: Joi.string().ip().allow(null),
  metadata: Joi.object().required(),
  previousHash: Joi.string().length(64).allow('').required(),
  currentHash: Joi.string().length(64).allow('').required(),
  signature: Joi.string().allow('').required()
});