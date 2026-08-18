/**
 * @file index.js
 * @description Configuración principal de Swagger/OpenAPI
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import env from '../env.js';
import schemas from './schemas/index.js';

/**
 * Metadatos de la API
 */
const apiInfo = {
  title: 'CampusVote API',
  version: env.APP_VERSION || '1.0.0',
  description: `
API para sistema de votación universitaria CampusVote.

## Autenticación
Esta API usa **JWT (JSON Web Tokens)** para autenticación.

### Pasos para autenticarte:
1. Haz login en \`POST /api/auth/login\`
2. Copia el token de la respuesta
3. Haz clic en el botón **"Authorize"** arriba
4. Pega el token (sin "Bearer")

## Convenciones
- Todas las respuestas siguen el formato: \`{ success, data, error }\`
- Fechas en formato **ISO 8601** (UTC)
- IDs en formato **UUID v4**
- Paginación con parámetros: \`page\`, \`limit\`
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

/**
 * Servidores disponibles
 */
const servers = [
  {
    url: `http://localhost:${env.PORT}`,
    description: 'Development server',
  },
  {
    url: 'https://api.campusvote.com',
    description: 'Production server',
  },
];

/**
 * Esquemas de seguridad
 */
const securitySchemes = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Ingresa tu JWT token',
  },
};

/**
 * Tags para agrupar endpoints
 */
const tags = [
  { name: 'Health', description: 'Endpoints de verificación de estado' },
  { name: 'Auth', description: 'Autenticación y gestión de sesiones' },
  { name: 'Users', description: 'Gestión de usuarios' },
  { name: 'Organizations', description: 'Gestión de organizaciones (tenants)' },
  { name: 'Elections', description: 'Gestión de elecciones' },
  { name: 'Voting', description: 'Proceso de votación' },
  { name: 'Ballots', description: 'Gestión de boletas' },
  { name: 'Results', description: 'Resultados y estadísticas' },
];

/**
 * Opciones completas de Swagger
 */
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
  },
  apis: ['./src/routes/*.js', './src/modules/**/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);

/**
 * Middleware para montar Swagger en la app
 * @param {import('express').Application} app
 */
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

  // Endpoint JSON con la especificación OpenAPI
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
};