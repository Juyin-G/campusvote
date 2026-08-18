/**
 * @file election.schema.js
 * @description Schemas para elecciones, candidaturas y reglas
 */

const ElectionSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
    },
    title: {
      type: 'string',
      example: 'Elección de Representantes Estudiantiles 2024',
    },
    description: {
      type: 'string',
    },
    process_type: {
      type: 'string',
      enum: ['VOTE', 'FAIR', 'FEEDBACK', 'FORM'],
      example: 'VOTE',
    },
    election_type: {
      type: 'string',
      enum: ['UNIVERSITY', 'FACULTY', 'PROGRAM'],
      example: 'UNIVERSITY',
    },
    period_id: {
      type: 'string',
      format: 'uuid',
      description: 'ID del período académico',
    },
    faculty_id: {
      type: 'string',
      format: 'uuid',
      nullable: true,
    },
    program_id: {
      type: 'string',
      format: 'uuid',
      nullable: true,
    },
    status: {
      type: 'string',
      enum: ['DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'CERTIFIED', 'PUBLISHED'],
      example: 'OPEN',
    },
    start_at: {
      type: 'string',
      format: 'date-time',
    },
    end_at: {
      type: 'string',
      format: 'date-time',
    },
    is_anonymous_allowed: {
      type: 'boolean',
    },
    created_by: {
      type: 'string',
      format: 'uuid',
    },
    form_structure: {
      type: 'object',
      nullable: true,
      description: 'Estructura JSON para formularios (solo process_type = FORM)',
    },
    created_at: {
      type: 'string',
      format: 'date-time',
    },
    updated_at: {
      type: 'string',
      format: 'date-time',
    },
  },
};

const CreateElectionRequestSchema = {
  type: 'object',
  required: [
    'title',
    'process_type',
    'election_type',
    'period_id',
    'start_at',
    'end_at',
  ],
  properties: {
    title: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
    },
    description: {
      type: 'string',
      default: '',
    },
    process_type: {
      type: 'string',
      enum: ['VOTE', 'FAIR', 'FEEDBACK', 'FORM'],
    },
    election_type: {
      type: 'string',
      enum: ['UNIVERSITY', 'FACULTY', 'PROGRAM'],
    },
    period_id: {
      type: 'string',
      format: 'uuid',
    },
    faculty_id: {
      type: 'string',
      format: 'uuid',
      nullable: true,
    },
    program_id: {
      type: 'string',
      format: 'uuid',
      nullable: true,
    },
    start_at: {
      type: 'string',
      format: 'date-time',
    },
    end_at: {
      type: 'string',
      format: 'date-time',
    },
    is_anonymous_allowed: {
      type: 'boolean',
      default: false,
    },
    form_structure: {
      type: 'object',
      nullable: true,
    },
  },
};

const CandidateListSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    election_id: { type: 'string', format: 'uuid' },
    name: { type: 'string', example: 'Lista Estudiantil' },
    acronym: { type: 'string', example: 'LE', nullable: true },
    motto: { type: 'string', nullable: true },
    logo: { type: 'string', format: 'uri', nullable: true },
    created_at: { type: 'string', format: 'date-time' },
  },
};

const CandidacySchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    election_id: { type: 'string', format: 'uuid' },
    candidate_list_id: { type: 'string', format: 'uuid' },
    position_id: { type: 'string', format: 'uuid', nullable: true },
    user_id: { type: 'string', format: 'uuid' },
    order_index: { type: 'integer', minimum: 1 },
    is_principal: { type: 'boolean' },
    user: { $ref: '#/components/schemas/User' },
  },
};

const ElectionRulesSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    election_id: { type: 'string', format: 'uuid' },
    min_turnout_percentage: {
      type: 'number',
      minimum: 0,
      maximum: 100,
    },
    allow_blank_vote: { type: 'boolean' },
    allow_null_vote: { type: 'boolean' },
    max_positions_per_ballot: { type: 'integer', minimum: 1 },
    requires_2fa: { type: 'boolean' },
  },
};

export default {
  Election: ElectionSchema,
  CreateElectionRequest: CreateElectionRequestSchema,
  CandidateList: CandidateListSchema,
  Candidacy: CandidacySchema,
  ElectionRules: ElectionRulesSchema,
};