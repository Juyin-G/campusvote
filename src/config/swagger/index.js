/**
 * @file index.js
 * @description Configuración principal de Swagger/OpenAPI para CampusVote
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import env from '../env.js';
import schemas from './schemas/index.js';

const apiInfo = {
  title: 'CampusVote API',
  version: env.APP_VERSION || '1.0.0',
  description: `
API para sistema de votación universitaria CampusVote.

## Autenticación
Esta API usa **JWT (JSON Web Tokens)** para autenticación.

### Pasos para autenticarte:
1. Haz login en \`POST /api/v1/auth/login\`
2. Copia el token recibido en la respuesta
3. Haz clic en el botón **"Authorize"** (arriba a la derecha)
4. Pega el token en el campo correspondiente

## Convenciones
- Respuestas estandarizadas: \`{ success: boolean, data: object|array, error: object|null }\`
- Fechas en formato **ISO 8601** (UTC)
- IDs únicos en formato **UUID v4**
- Paginación con query params: \`page\` (default: 1), \`limit\` (default: 10)
  `,
  contact: {
    name: 'CampusVote Team',
    email: 'support@campusvote.com',
  },
  license: {
    name: 'MIT',
    url: 'https://opensource.org/licenses/MIT',
  },
};

const servers = [
  {
    url: `http://localhost:${env.PORT || 3000}/api/v1`,
    description: 'Servidor de Desarrollo (v1)',
  },
  {
    url: 'https://api.campusvote.com/api/v1',
    description: 'Servidor de Producción (v1)',
  },
];

const securitySchemes = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Ingresa tu JWT token obtenido en el login',
  },
};

const tags = [
  { name: 'Health', description: 'Verificación de estado del servicio' },
  { name: 'Auth', description: 'Autenticación, recuperación y sesión ' },
  { name: 'Users', description: 'Gestión de usuarios y perfiles' },
  { name: 'Organizations', description: 'Gestión de organizaciones (tenants)' },
  { name: 'Elections', description: 'Configuración y ciclo de vida de elecciones' },
  { name: 'Voting', description: 'Emisión y registro de votos' },
  { name: 'Ballots', description: 'Gestión de boletas electorales' },
  { name: 'Results', description: 'Escrutinio y métricas estadísticas' },
];

const options = {
  definition: {
    openapi: '3.0.0',
    info: apiInfo,
    servers,
    components: {
      securitySchemes,
      schemas,
    },
    tags,
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // Escanea ÚNICAMENTE los archivos dedicados a documentación
  apis: ['./src/modules/**/*.docs.js'],
};

export const swaggerSpec = swaggerJsdoc(options);

export const swaggerSetup = (app) => {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'CampusVote API Documentation',
      customfavIcon: '/favicon.ico',
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
        filter: true,
        showRequestDuration: true,
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
      },
    })
  );

  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(swaggerSpec);
  });
};