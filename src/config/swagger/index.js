/**
 * @file index.js
 * @description Configuración centralizada e inicialización de OpenAPI / Swagger UI.
 * @module config/swagger
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import env from '../env.js';
import schemas from './schemas/index.js';
import { responses } from './responses.js';

// Metadata principal de la API
const apiInfo = {
  title: 'CampusVote API',
  version: env.APP_VERSION || '1.0.0',
  description: `
### Sistema de Votación Universitaria - API RESTful

#### Autenticación
Esta API utiliza esquemas de autenticación basados en **JWT (JSON Web Tokens)**.

1. Autentícate en \`POST /api/v1/auth/login\`.
2. Copia el token de acceso devuelto en la respuesta.
3. Haz clic en el botón **Authorize** ubicado arriba a la derecha e ingresa tu token.

#### Convenciones de Respuesta
- **Formato Estándar:** \`{ "success": boolean, "data": object|array, "error": object|null }\`
- **Marcas de Tiempo:** Estándar **ISO 8601** (UTC).
- **Identificadores:** Identificadores únicos globales **UUID v4**.
- **Paginación:** Mediante parámetros de consulta \`page\` (defecto: 1) y \`limit\` (defecto: 10).
  `,
  contact: {
    name: 'CampusVote Engineering Team',
    email: 'support@campusvote.com',
  },
  license: {
    name: 'MIT',
    url: 'https://opensource.org/licenses/MIT',
  },
};

// Construcción dinámica de servidores
const servers = [
  {
    url: env.APP_URL || `http://localhost:${env.PORT || 3000}`,
    description: `Servidor de Desarrollo (${env.NODE_ENV || 'development'})`,
  },
  ...(env.STAGE_API_URL
    ? [{ url: env.STAGE_API_URL, description: 'Servidor de Staging / QA' }]
    : []),
  ...(env.PROD_API_URL
    ? [{ url: env.PROD_API_URL, description: 'Servidor de Producción' }]
    : []),
];

// Esquemas de Seguridad
const securitySchemes = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Ingrese el token JWT con prefijo Bearer generado tras iniciar sesión.',
  },
};

// Categorización global de Endpoints
const tags = [
  { name: 'Health', description: 'Monitoreo y diagnóstico del estado de la infraestructura' },
  { name: 'Auth', description: 'Gestión de autenticación, sesión y recuperación' },
  { name: 'Users', description: 'Administración de usuarios y perfiles' },
  { name: 'Organizations', description: 'Gestión multitenant de instituciones y organizaciones' },
  { name: 'Elections', description: 'Ciclo de vida y parámetros de procesos electorales' },
  { name: 'Voting', description: 'Registro y validación de votos criptográficos' },
  { name: 'Ballots', description: 'Gestión de cédulas y configuraciones de votación' },
  { name: 'Results', description: 'Escrutinio automatizado y análisis métrico' },
];

const options = {
  definition: {
    openapi: '3.0.3',
    info: apiInfo,
    servers,
    components: {
      securitySchemes,
      schemas,
      responses,
    },
    tags,
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './src/modules/**/*.docs.js',
    './src/config/swagger/schemas/**/*.js',
  ],
};

/**
 * Especificación OpenAPI compilada
 */
export const swaggerSpec = swaggerJsdoc(options);

/**
 * Registra la interfaz gráfica Swagger UI y el endpoint JSON en la aplicación Express.
 * @param {import('express').Application} app - Instancia principal de Express.
 */
export const swaggerSetup = (app) => {
  // Opcional: Desactivar en entornos donde no se requiera la UI
  if (env.SWAGGER_ENABLED === false) {
    return;
  }

  const swaggerUiOptions = {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 20px 0 }
      .swagger-ui .scheme-container { padding: 15px 0 }
    `,
    customSiteTitle: 'CampusVote API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
      tryItOutEnabled: true,
    },
  };

  // UI Interactive Documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

  // JSON Raw Specification Endpoint
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(swaggerSpec);
  });
};