import Joi from 'joi';

export const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  VERIFY_2FA: 'VERIFY_2FA',
  ACCESS_DENIED: 'ACCESS_DENIED',
  CAST_FAIR_VOTE: 'CAST_FAIR_VOTE',
  FAIR_VOTE_ATTEMPT_DENIED: 'FAIR_VOTE_ATTEMPT_DENIED',
  RUBRIC_CHECKLIST_FINALIZED: 'RUBRIC_CHECKLIST_FINALIZED',
  PROJECT_LIKED: 'PROJECT_LIKED',
  PROJECT_COMMENTED: 'PROJECT_COMMENTED',
  USER_BULK_EXCEL_IMPORT: 'USER_BULK_EXCEL_IMPORT',
};


// Esquema de UUID compatible con v4, v7 u otros estándares de BD
export const uuidSchema = Joi.string().uuid();

export const auditLogsQuerySchema = Joi.object({
  action: Joi.string()
    .valid(...Object.values(AUDIT_ACTIONS))
    .optional(),

  actorId: uuidSchema.optional(),

  fromDate: Joi.date().iso().optional(),
  toDate: Joi.date()
    .iso()
    .optional()
    .when('fromDate', {
      is: Joi.exist(),
      then: Joi.date().min(Joi.ref('fromDate'))
    }),

  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
}).with('toDate', 'fromDate');

export const createAuditLogSchema = Joi.object({
  actorId: uuidSchema.optional().allow(null),
  action: Joi.string()
    .valid(...Object.values(AUDIT_ACTIONS))
    .required(),
  ipAddress: Joi.string().ip().optional().allow(null),
  metadata: Joi.object().optional().default({})
});

export const auditLogResponseSchema = Joi.object({
  id: uuidSchema.required(),
  sequenceNum: Joi.alternatives().try(Joi.string(), Joi.number().integer()).required(),
  actorId: uuidSchema.allow(null),
  action: Joi.string().valid(...Object.values(AUDIT_ACTIONS)).required(),
  timestamp: Joi.date().iso().required(),
  ipAddress: Joi.string().ip().allow(null),
  metadata: Joi.object().required(),
  previousHash: Joi.string().length(64).allow('').required(),
  currentHash: Joi.string().length(64).allow('').required(),
  signature: Joi.string().allow('').required()
});