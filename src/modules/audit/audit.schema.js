import Joi from 'joi';

export const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  VERIFY_2FA: 'VERIFY_2FA',
  CREATE_ELECTION: 'CREATE_ELECTION',
  OPEN_ELECTION: 'OPEN_ELECTION',
  CAST_VOTE: 'CAST_VOTE',
  CLOSE_ELECTION: 'CLOSE_ELECTION',
  CERTIFY_RESULT: 'CERTIFY_RESULT',
  PUBLISH_RESULT: 'PUBLISH_RESULT',
  FILE_OBJECTION: 'FILE_OBJECTION',
  RESOLVE_OBJECTION: 'RESOLVE_OBJECTION',
  ASSIGN_JURY: 'ASSIGN_JURY',
  SUBMIT_RATING: 'SUBMIT_RATING',
  REVOKE_RATING: 'REVOKE_RATING',
  RESTORE_RATING: 'RESTORE_RATING',
  ACCESS_DENIED: 'ACCESS_DENIED',
  REVOKE_JURY: 'REVOKE_JURY',
  DECLARE_JURY_CONFLICT: 'DECLARE_JURY_CONFLICT',
  CLEAR_JURY_CONFLICT: 'CLEAR_JURY_CONFLICT',
  REGENERATE_BALLOT: 'REGENERATE_BALLOT',
  REOPEN_RATING: 'REOPEN_RATING',
  CAST_FAIR_VOTE: 'CAST_FAIR_VOTE',
  FAIR_VOTE_ATTEMPT_DENIED: 'FAIR_VOTE_ATTEMPT_DENIED',
  RUBRIC_CHECKLIST_FINALIZED: 'RUBRIC_CHECKLIST_FINALIZED',
};


// Esquema de UUID compatible con v4, v7 u otros estándares de BD
export const uuidSchema = Joi.string().uuid();

export const auditLogsQuerySchema = Joi.object({
  action: Joi.string()
    .valid(...Object.values(AUDIT_ACTIONS))
    .optional(),
  
  electionId: uuidSchema.optional(),
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
  electionId: uuidSchema.optional().allow(null),
  action: Joi.string()
    .valid(...Object.values(AUDIT_ACTIONS))
    .required(),
  ipAddress: Joi.string().ip().optional().allow(null),
  metadata: Joi.object().optional().default({})
}).when(
  Joi.object({ action: AUDIT_ACTIONS.CAST_VOTE }).unknown(),
  {
    then: Joi.object({
      actorId: Joi.forbidden().messages({
        'any.unknown': 'El voto debe ser anónimo: actorId no está permitido.'
      }),
      ipAddress: Joi.forbidden().messages({
        'any.unknown': 'El voto debe ser anónimo: ipAddress no está permitida.'
      }),
      metadata: Joi.object().pattern(
        /^(voter_email|voter_name|ip|user_id)$/,
        Joi.any().forbidden()
      ).messages({
        'object.pattern.match': 'Metadatos contienen llaves de identidad prohibidas para CAST_VOTE.'
      })
    })
  }
);

export const createOneTimeTokenSchema = Joi.object({
  userId: uuidSchema.required(),
  electionId: uuidSchema.required(),
  expiresAt: Joi.date().iso().required().greater('now')
});

export const consumeOneTimeTokenSchema = Joi.object({
  rawToken: Joi.string().trim().min(32).max(128).required(),
  electionId: uuidSchema.required()
});

export const checkTokenStatusSchema = Joi.object({
  token: Joi.string().trim().min(32).max(128).required(),
  electionId: uuidSchema.required()
});

export const auditLogResponseSchema = Joi.object({
  id: uuidSchema.required(),
  sequenceNum: Joi.alternatives().try(Joi.string(), Joi.number().integer()).required(),
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