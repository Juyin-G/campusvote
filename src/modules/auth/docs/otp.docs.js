export const otpDocs = {
  tags: [
    {
      name: 'OTP - Two Factor Authentication',
      description: 'Gestión de autenticación de dos factores (TOTP)',
    },
  ],

  paths: {
    '/api/auth/otp/setup': {
      post: {
        summary: 'Iniciar configuración de 2FA',
        description: 'Genera un secreto TOTP y la URI para asociar una app autenticadora.',
        tags: ['OTP - Two Factor Authentication'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Configuración iniciada exitosamente',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/OtpSetupResponse' },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: {
            description: 'No autorizado / Token faltante o expirado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          409: {
            description: '2FA ya está habilitado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          429: {
            description: 'Demasiadas solicitudes. Intente más tarde.',
          },
        },
      },
    },

    '/api/auth/otp/verify': {
      post: {
        summary: 'Verificar código TOTP y habilitar 2FA',
        description: 'Verifica el código de la app de autenticación y habilita el 2FA de forma definitiva.',
        tags: ['OTP - Two Factor Authentication'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OtpVerifyRequest' },
            },
          },
        },
        responses: {
          200: {
            description: '2FA habilitado exitosamente. Se entregan los códigos de respaldo definitivos.',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/OtpEnableResponse' },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description: 'Código inválido o configuración no iniciada',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          401: {
            description: 'No autorizado / Token faltante o expirado',
          },
          429: {
            description: 'Demasiadas solicitudes de verificación.',
          },
        },
      },
    },

    '/api/auth/otp/verify-login': {
      post: {
        summary: 'Verificar TOTP durante el login',
        description: 'Verifica el código TOTP o un código de respaldo para completar la autenticación.',
        tags: ['OTP - Two Factor Authentication'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OtpLoginVerifyRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Verificación exitosa',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            valid: { type: 'boolean', example: true },
                            remainingCodes: {
                              type: 'integer',
                              description: 'Cantidad de códigos de respaldo restantes (solo al usar backupCode)',
                              example: 7,
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description: 'Código TOTP o de respaldo inválido',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          401: {
            description: 'No autorizado / Token faltante o expirado',
          },
          403: {
            description: 'Se requiere sesión temporal de verificación TOTP',
          },
          429: {
            description: 'Demasiados intentos fallidos.',
          },
        },
      },
    },

    '/api/auth/otp/disable': {
      post: {
        summary: 'Deshabilitar 2FA',
        description: 'Elimina la configuración de 2FA previa confirmación obligatoria de contraseña.',
        tags: ['OTP - Two Factor Authentication'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OtpDisableRequest' },
            },
          },
        },
        responses: {
          200: {
            description: '2FA deshabilitado exitosamente',
          },
          400: {
            description: '2FA no está habilitado o la contraseña es incorrecta',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          401: {
            description: 'No autorizado / Token faltante o contraseña incorrecta',
          },
          429: {
            description: 'Demasiadas solicitudes. Intente más tarde.',
          },
        },
      },
    },
  },

  components: {
    schemas: {
      OtpSetupResponse: {
        type: 'object',
        required: ['secret', 'uri', 'backupCodes'],
        properties: {
          secret: {
            type: 'string',
            description: 'Secreto TOTP en formato Base32',
            example: 'JBSWY3DPEHPK3PXP',
          },
          uri: {
            type: 'string',
            description: 'URI para generar código QR (otpauth://)',
            example: 'otpauth://totp/MyApp:user@email.com?secret=JBSWY3DPEHPK3PXP&issuer=MyApp',
          },
          backupCodes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Vista previa de códigos de respaldo (se confirman al activar)',
            example: ['a1b2c3d4', 'e5f6g7h8'],
          },
        },
      },

      OtpVerifyRequest: {
        type: 'object',
        required: ['code'],
        properties: {
          code: {
            type: 'string',
            description: 'Código de 6 dígitos de la app de autenticación',
            example: '123456',
            minLength: 6,
            maxLength: 6,
          },
        },
      },

      OtpDisableRequest: {
        type: 'object',
        required: ['password'],
        properties: {
          password: {
            type: 'string',
            description: 'Contraseña actual del usuario para confirmar la acción',
            example: 'Password123!',
          },
        },
      },

      OtpEnableResponse: {
        type: 'object',
        required: ['backupCodes'],
        properties: {
          backupCodes: {
            type: 'array',
            items: { type: 'string' },
            description: 'CÓDIGOS DE RESPALDO DEFINITIVOS - Guárdalos en un lugar seguro',
            example: ['a1b2c3d4', 'e5f6g7h8', 'i9j0k1l2', 'm3n4o5p6'],
          },
        },
      },

      OtpLoginVerifyRequest: {
        type: 'object',
        description: 'Debe incluir `code` O `backupCode`',
        properties: {
          code: {
            type: 'string',
            description: 'Código TOTP de 6 dígitos',
            example: '123456',
          },
          backupCode: {
            type: 'string',
            description: 'Código de respaldo de 8 caracteres',
            example: 'a1b2c3d4',
          },
        },
      },
    },
  },
};

export default otpDocs;