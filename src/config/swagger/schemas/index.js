/**
 * @file index.js
 * @description Agrupa todos los schemas de la API
 */

import userSchemas from './user.schema.js';
import authSchemas from './auth.schema.js';
import organizationSchemas from './organization.schema.js';
import electionSchemas from './election.schema.js';
import responseSchemas from './responses.schema.js';

/**
 * Todos los schemas combinados en un solo objeto
 * para ser inyectados en components.schemas de Swagger
 */
const schemas = {
  ...userSchemas,
  ...authSchemas,
  ...organizationSchemas,
  ...electionSchemas,
  ...responseSchemas,
};

export default schemas;