// src/config/swagger.js
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import env from '../env.js';
import schemas from './schemas/index.js';
import { responses } from './responses.js';
import voterRegistryDocs from '../../modules/academic/voter-registry/voter-registry.docs.js';

// Metadata principal de la API
const apiInfo = {
  title: 'CampusVote API',
  version: env.APP_VERSION || '1.0.0',
  description: `
### Sistema de Votación Universitaria - API RESTful

#### Autenticación
Esta API utiliza esquemas de autenticación basados en **JWT (JSON Web Tokens)**.

1. Autentícate en \`POST /api/auth/login\`.
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
    // URL relativa: Swagger UI la resuelve contra el origen desde el que se
    // sirve la documentacion, asi que apunta sola al servidor correcto tanto
    // en local como en el despliegue, sin depender de variables de entorno.
    // Lleva /api porque es donde app.js monta el router de la API.
    url: env.APP_URL || '/api',
    description: `Servidor actual (${env.NODE_ENV || 'development'})`,
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

const tags = [
  { name: 'Health', description: 'Monitoreo y diagnóstico del estado de la infraestructura' },
  { name: 'Auth', description: 'Gestión de autenticación, sesión y recuperación' },
  { name: 'Users', description: 'Administración de usuarios y perfiles' },
  { name: 'Organizations', description: 'Gestión multitenant de instituciones y organizaciones' },
  { name: 'Elecciones', description: 'Ciclo de vida y parámetros de procesos electorales' },
  { name: 'Voter Registry', description: 'Gestión del padrón electoral y reclamos de inscripción' },
  { name: 'Voting', description: 'Registro y validación de votos criptográficos' },
  { name: 'Ballots', description: 'Gestión de cédulas y configuraciones de votación' },
  { name: 'Results', description: 'Escrutinio automatizado y análisis métrico' },
  { name: 'Audit', description: 'Trazabilidad de logs de auditoría y gestión de tokens de un solo uso' },
  { name: 'Platform Translations', description: 'Gestión del diccionario de internacionalización (i18n) y locales' },
  { name: 'Notifications', description: 'Gestión de notificaciones del usuario y bandeja de entrada' },
  { name: 'Fairs', description: 'Ciclo de vida y estado de ferias académicas' },
  { name: 'FairJuries', description: 'Asignación de jurados a ferias académicas' },
  { name: 'Fair Categories', description: 'Categorías de proyectos de ferias académicas' },
  { name: 'Fair Stands', description: 'Stands/cabinas de ferias académicas' },
  { name: 'Fair Evaluations', description: 'Rúbricas, declaraciones, evaluaciones y avance del jurado' },
  { name: 'Fair Results', description: 'Resultados y ranking de ferias académicas' },
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
    paths: voterRegistryDocs,
    tags,
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './src/modules/**/*.docs.js',
    './src/modules/**/*.routes.js',
    './src/modules/**/*.route.js',
    './src/config/swagger/schemas/**/*.js',
  ],
};

/**
 * Especificación OpenAPI compilada.
 * Se genera bajo demanda (lazy) para no cargar el parser de Swagger
 * (módulo ESM) cuando la documentación no se necesita, p. ej. en tests.
 */
let _swaggerSpec = null;
export const getSwaggerSpec = () => {
  if (!_swaggerSpec) {
    _swaggerSpec = swaggerJsdoc(options);
  }
  return _swaggerSpec;
};

/**
 * Registra la interfaz gráfica Swagger UI y el endpoint JSON en la aplicación Express.
 * @param {import('express').Application} app - Instancia principal de Express.
 */
export const swaggerSetup = (app) => {
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

  const spec = getSwaggerSpec();

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec, swaggerUiOptions));

  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(getSwaggerSpec());
  });
};