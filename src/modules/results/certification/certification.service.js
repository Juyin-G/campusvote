// src/modules/results/certification/certification.service.js


import * as electionService from '../../elections/elections/election.service.js';
import * as tallyService from '../tally/tally.service.js';
import auditService from '../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../audit/audit.schema.js';
import { ApiError } from '../../../shared/errors/ApiError.js';

const assertElectionId = (electionId) => {
  if (!electionId || typeof electionId !== 'string') {
    throw ApiError.badRequest('El ID de la elección es requerido');
  }
};

/**
 * Certifica una elección cerrada.
 *
 * Flujo:
 *   1. Valida el electionId.
 *   2. Recalcula tallies (necesario para que certify_election()
 *      SQL tenga datos correctos de blank/null).
 *      Si el recálculo falla, NO se certifica.
 *   3. Invoca electionService.changeStatus(id, 'CERTIFIED'),
 *      que respeta ALLOWED_TRANSITIONS, assertTransitionRules y
 *      traduce errores de certify_election() (translateCertifyError).
 *      Si la certificación falla, NO se registra audit.
 *   4. Solo después de éxito, registra CERTIFY_RESULT en audit_logs.
 *   5. Devuelve la elección certificada.
 */
export const certifyElection = async (electionId, actor = {}, ipAddress = null) => {
  assertElectionId(electionId);

  // 1. Recalcular tallies. Si falla, abortar sin certificar.
  await tallyService.recalculateTallies(electionId);

  // 2. Cambiar estado via la capa de servicio (conserva reglas).
  const actorId = actor.userId ?? actor.id ?? null;
  const certified = await electionService.changeStatus(
    electionId,
    'CERTIFIED',
    actorId
  );

  // 3. Solo tras éxito, registrar audit.
  await auditService.logAction({
    actorId,
    electionId,
    action: AUDIT_ACTIONS.CERTIFY_RESULT,
    ipAddress,
    metadata: {
      new_status: certified.status,
      source: 'results.certification',
    },
  });

  return certified;
};

export default {
  certifyElection,
};
