/**
 * @file responses.schema.js
 * @description Schemas genéricos para respuestas de la API
 */

const ErrorResponseSchema = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      example: false,
    },
    error: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          example: 'VALIDATION_ERROR',
          description: 'Código del error para manejo programático',
        },
        message: {
          type: 'string',
          example: 'El email ya está registrado',
          description: 'Mensaje legible para el usuario',
        },
        details: {
          type: 'array',
          description: 'Detalles específicos del error (validaciones)',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string', example: 'email' },
              message: { type: 'string', example: 'Email already exists' },
            },
          },
        },
      },
    },
  },
};

const SuccessResponseSchema = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      example: true,
    },
    message: {
      type: 'string',
      example: 'Operación exitosa',
    },
    data: {
      type: 'object',
      description: 'Datos retornados (estructura variable)',
    },
  },
};

const PaginatedResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: {
      type: 'array',
      items: { type: 'object' },
    },
    pagination: {
      type: 'object',
      properties: {
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        total: { type: 'integer', example: 150 },
        totalPages: { type: 'integer', example: 8 },
        hasNext: { type: 'boolean' },
        hasPrev: { type: 'boolean' },
      },
    },
  },
};

const HealthCheckSchema = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['ok', 'degraded', 'error'],
      example: 'ok',
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
    },
    uptime: {
      type: 'number',
      description: 'Tiempo de ejecución en segundos',
    },
    version: {
      type: 'string',
      example: '1.0.0',
    },
    checks: {
      type: 'object',
      properties: {
        database: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['up', 'down'] },
            latency_ms: { type: 'number' },
          },
        },
        memory: {
          type: 'object',
          properties: {
            rss_mb: { type: 'number' },
            heap_used_mb: { type: 'number' },
          },
        },
      },
    },
  },
};

export default {
  ErrorResponse: ErrorResponseSchema,
  SuccessResponse: SuccessResponseSchema,
  PaginatedResponse: PaginatedResponseSchema,
  HealthCheck: HealthCheckSchema,
};