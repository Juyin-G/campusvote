// src/config/swagger/responses.js

export const responses = {
  BadRequest: {
    description: 'Petición incorrecta o datos de entrada no válidos',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'BAD_REQUEST' },
                message: { type: 'string', example: 'Datos de entrada inválidos' },
              },
            },
          },
        },
      },
    },
  },
  Unauthorized: {
    description: 'No autorizado. Token no proporcionado o inválido',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'UNAUTHORIZED' },
                message: { type: 'string', example: 'Token de acceso no proporcionado o expirado' },
              },
            },
          },
        },
      },
    },
  },
  Forbidden: {
    description: 'Acceso prohibido. No tienes los permisos necesarios',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'FORBIDDEN' },
                message: { type: 'string', example: 'No tienes permisos para realizar esta acción' },
              },
            },
          },
        },
      },
    },
  },
  NotFound: {
    description: 'Recurso no encontrado',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'NOT_FOUND' },
                message: { type: 'string', example: 'El recurso solicitado no existe' },
              },
            },
          },
        },
      },
    },
  },
  InternalServerError: {
    description: 'Error interno del servidor',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'INTERNAL_SERVER_ERROR' },
                message: { type: 'string', example: 'Error interno inesperado' },
              },
            },
          },
        },
      },
    },
  },
};