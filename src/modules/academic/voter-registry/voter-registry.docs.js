/**
 * @openapi
 * tags:
 *   name: Voter Registry
 *   description: Gestión del padrón electoral y sincronización con el sistema SIS
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     VoterRegistry:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "d3b07384-d113-424a-802d-0b73c4f74d47"
 *         userId:
 *           type: string
 *           format: uuid
 *           example: "8f7e2a10-3c2b-4d5e-9f1a-2b3c4d5e6f7a"
 *         programId:
 *           type: string
 *           format: uuid
 *           example: "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d"
 *         periodId:
 *           type: string
 *           format: uuid
 *           example: "9f8e7d6c-5b4a-3f2e-1d0c-9b8a7f6e5d4c"
 *         semester:
 *           type: integer
 *           example: 5
 *         isEligible:
 *           type: boolean
 *           example: true
 *         eligibilityReason:
 *           type: string
 *           nullable: true
 *           example: "ENROLLED_SIS"
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     SyncSisPayload:
 *       type: object
 *       required:
 *         - periodId
 *         - students
 *       properties:
 *         periodId:
 *           type: string
 *           format: uuid
 *           example: "9f8e7d6c-5b4a-3f2e-1d0c-9b8a7f6e5d4c"
 *         students:
 *           type: array
 *           items:
 *             type: object
 *             required:
 *               - institutional_id
 *               - program_id
 *               - cycle
 *             properties:
 *               institutional_id:
 *                 type: string
 *                 example: "20210045"
 *               program_id:
 *                 type: string
 *                 format: uuid
 *                 example: "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d"
 *               cycle:
 *                 type: integer
 *                 example: 5
 *
 *     SyncSisResponse:
 *       type: object
 *       properties:
 *         processed:
 *           type: integer
 *           example: 1500
 *         updated:
 *           type: integer
 *           example: 200
 *         protected:
 *           type: integer
 *           example: 5
 *         unmatched:
 *           type: integer
 *           example: 12
 */

const voterRegistryDocs = {
  '/api/academic/voter-registries/sync-sis': {
    post: {
      tags: ['Voter Registry'],
      summary: 'Sincronización masiva de estudiantes desde el SIS',
      description: 'Ejecuta el procedimiento almacenado SQL `sync_sis_voters` para actualizar el padrón electoral.',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/SyncSisPayload' },
          },
        },
      },
      responses: {
        200: {
          description: 'Sincronización ejecutada con éxito.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Sincronización con el SIS ejecutada correctamente.' },
                  data: { $ref: '#/components/schemas/SyncSisResponse' },
                },
              },
            },
          },
        },
        400: { description: 'Payload inválido o malformado.' },
        401: { description: 'No autenticado.' },
        403: { description: 'Acceso denegado. Requiere rol ADMIN.' },
      },
    },
  },

  '/api/academic/voter-registries': {
    get: {
      tags: ['Voter Registry'],
      summary: 'Obtener padrón electoral paginado y filtrado',
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
        { name: 'periodId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        { name: 'programId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        { name: 'isEligible', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
        { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Búsqueda por código, correo o nombres' },
      ],
      responses: {
        200: { description: 'Lista de votantes obtenida exitosamente.' },
        401: { description: 'No autenticado.' },
      },
    },
    post: {
      tags: ['Voter Registry'],
      summary: 'Registrar manualmente un votante en el padrón',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['userId', 'programId', 'periodId', 'semester'],
              properties: {
                userId: { type: 'string', format: 'uuid' },
                programId: { type: 'string', format: 'uuid' },
                periodId: { type: 'string', format: 'uuid' },
                semester: { type: 'integer', example: 4 },
                isEligible: { type: 'boolean', default: true },
                eligibilityReason: { type: 'string', example: 'HABILITADO_MANUAL' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Votante registrado correctamente.' },
        409: { description: 'El usuario ya está registrado en este período.' },
      },
    },
  },

  '/api/academic/voter-registries/{id}': {
    get: {
      tags: ['Voter Registry'],
      summary: 'Obtener detalle de un votante del padrón',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: {
        200: { description: 'Detalle del votante.' },
        404: { description: 'Registro de votante no encontrado.' },
      },
    },
    patch: {
      tags: ['Voter Registry'],
      summary: 'Actualizar habilitación o datos de un votante',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                programId: { type: 'string', format: 'uuid' },
                semester: { type: 'integer' },
                isEligible: { type: 'boolean' },
                eligibilityReason: { type: 'string', example: 'INHABILITADO_POR_RECLAMO' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Registro actualizado correctamente.' },
        404: { description: 'Registro de votante no encontrado.' },
      },
    },
    delete: {
      tags: ['Voter Registry'],
      summary: 'Eliminar un registro del padrón electoral',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: {
        200: { description: 'Registro eliminado exitosamente.' },
        403: { description: 'Acceso denegado. Requiere rol ADMIN.' },
        404: { description: 'Registro de votante no encontrado.' },
      },
    },
  },
};

module.exports = voterRegistryDocs;