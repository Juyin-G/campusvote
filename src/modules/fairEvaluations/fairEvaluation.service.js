// src/modules/fairEvaluations/fairEvaluation.service.js
// Orquestador del módulo: re-exporta la API pública de los sub-servicios
// (rubric + responses) para que el controller siga importando este archivo.

export {
  loadFair,
  assertTenantMatch,
  assertJuryAssignedToFair,
  assertRubricOpenForResponse,
} from './fairEvaluation.access.js';

export { createRubric, updateRubric, getRubric, addCriterion, updateCriterion, removeCriterion } from './fairEvaluation.rubric.service.js';
export { upsertChecklist, getMyChecklist } from './fairEvaluation.responses.service.js';

import { createRubric, updateRubric, getRubric, addCriterion, updateCriterion, removeCriterion } from './fairEvaluation.rubric.service.js';
import { upsertChecklist, getMyChecklist } from './fairEvaluation.responses.service.js';
import { loadFair, assertTenantMatch, assertJuryAssignedToFair } from './fairEvaluation.access.js';
import { ROLES } from '../../constants/roles.js';

/** GET /rubric: ADMIN con tenant o JURY asignado. */
export const getRubricForActor = async ({ fairId, actor }) => {
  const fair = await loadFair(fairId);
  if (actor.role === ROLES.JURY) {
    await assertJuryAssignedToFair({ fairId, juryId: actor.id });
  } else {
    assertTenantMatch({ fair, actor });
  }
  return getRubric(fairId);
};

export default {
  createRubric,
  updateRubric,
  getRubric: getRubricForActor,
  addCriterion,
  updateCriterion,
  removeCriterion,
  upsertChecklist,
  getMyChecklist,
};
