// src/modules/ratings/rating.service.js
// Orquestador del módulo electoral de calificaciones (rating).
// Re-exporta la API pública desde los sub-servicios.

export { createCriterion, getCriteria, removeCriterion } from './rating.criteria.service.js';
export { rateProject, revokeRating, restoreRating } from './rating.lifecycle.service.js';
export { getRatingResults, listRatings } from './rating.results.service.js';
export { assertTenantAccess, isSuperAdmin } from './rating.access.js';

import {
  createCriterion,
  getCriteria,
  removeCriterion,
} from './rating.criteria.service.js';
import {
  rateProject,
  revokeRating,
  restoreRating,
} from './rating.lifecycle.service.js';
import { getRatingResults, listRatings } from './rating.results.service.js';

export default {
  createCriterion,
  getCriteria,
  removeCriterion,
  rateProject,
  revokeRating,
  restoreRating,
  getRatingResults,
  listRatings,
};
