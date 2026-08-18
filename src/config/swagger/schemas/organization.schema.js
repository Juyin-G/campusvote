/**
 * @file organization.schema.js
 * @description Schemas para organizaciones (tenants) y solicitudes
 */

const OrganizationSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
    },
    name: {
      type: 'string',
      example: 'Universidad Nacional',
      maxLength: 200,
    },
    code: {
      type: 'string',
      example: 'UNI_2024',
      description: 'Código único de la organización',
    },
    org_type: {
      type: 'string',
      enum: ['UNIVERSITY', 'INSTITUTE', 'SCHOOL', 'COMPANY', 'ASSOCIATION', 'OTHER'],
      example: 'UNIVERSITY',
    },
    is_active: {
      type: 'boolean',
    },
    logo: {
      type: 'string',
      format: 'uri',
      nullable: true,
      description: 'URL del logo',
    },
    primary_color: {
      type: 'string',
      example: '#0066CC',
      description: 'Color primario (formato HEX)',
    },
    secondary_color: {
      type: 'string',
      example: '#FFD700',
      description: 'Color secundario (formato HEX)',
    },
    country: {
      type: 'string',
      example: 'Perú',
    },
    timezone: {
      type: 'string',
      example: 'America/Lima',
    },
    onboarding_completed: {
      type: 'boolean',
    },
    onboarding_completed_at: {
      type: 'string',
      format: 'date-time',
      nullable: true,
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

const OrganizationRequestSchema = {
  type: 'object',
  required: [
    'institution_name',
    'institution_type',
    'country',
    'estimated_members',
    'contact_email',
  ],
  properties: {
    institution_name: {
      type: 'string',
      example: 'Universidad Tecnológica',
      maxLength: 200,
    },
    institution_type: {
      type: 'string',
      enum: ['UNIVERSITY', 'INSTITUTE', 'SCHOOL', 'COMPANY', 'ASSOCIATION', 'OTHER'],
      example: 'UNIVERSITY',
    },
    country: {
      type: 'string',
      example: 'Perú',
    },
    estimated_members: {
      type: 'integer',
      minimum: 1,
      example: 5000,
    },
    contact_email: {
      type: 'string',
      format: 'email',
      example: 'contacto@universidad.edu',
    },
    contact_phone: {
      type: 'string',
      example: '+51 999 999 999',
      nullable: true,
    },
    message: {
      type: 'string',
      example: 'Necesitamos implementar votaciones estudiantiles',
      nullable: true,
    },
  },
};

const OrganizationRequestReviewSchema = {
  type: 'object',
  required: ['approved'],
  properties: {
    approved: {
      type: 'boolean',
      description: 'true = aprobar, false = rechazar',
    },
    rejection_reason: {
      type: 'string',
      description: 'Obligatorio si approved = false',
      nullable: true,
    },
  },
};

export default {
  Organization: OrganizationSchema,
  OrganizationRequest: OrganizationRequestSchema,
  OrganizationRequestReview: OrganizationRequestReviewSchema,
};