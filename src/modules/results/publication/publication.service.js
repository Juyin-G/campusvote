// src/modules/results/publication/publication.service.js
// S7-04 — Servicio de publicación de resultados.
//
// Responsabilidades:
//   - Validar que la elección exista y esté CERTIFIED.
//   - Validar quórum (turnoutPercentage >= minTurnoutPercentage).
//     Esta validación es PROPIA del dominio Results y NO existe
//     en election.service.changeStatus.
//   - Reutilizar electionService.changeStatus() para conservar
//     ALLOWED_TRANSITIONS, assertTransitionRules y futuras reglas.
//   - Registrar PUBLISH_RESULT en audit SOLO tras publicación exitosa.
//
// NO invoca directamente la funcion SQL de cambio de estado.
// NO conoce HTTP.

import * as electionService from '../../elections/elections/election.service.js';
import * as electionRepository from '../../elections/elections/election.repository.js';
import * as electionRulesRepository from '../../elections/electionRules/electionRules.repository.js';
import auditService from '../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../audit/audit.schema.js';
import resultsRepository from '../results.repository.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import MESSAGES from '../../../constants/messages.js';

const assertElectionId = (electionId) => {
  if (!electionId || typeof electionId !== 'string') {
    throw ApiError.badRequest('El ID de la elección es requerido');
  }
};

/**
 * Publica los resultados de una elección certificada.
 *
 * Flujo:
 *   1. Valida el electionId.
 *   2. Verifica que la elección exista.
 *   3. Verifica que esté CERTIFIED (control propio de Results).
 *   4. Lee election_rules.min_turnout_percentage.
 *   5. Lee election_results.turnoutPercentage.
 *   6. Valida quorum. Si NO se cumple → 409 y aborta.
 *   7. Cambia estado a PUBLISHED via electionService.changeStatus.
 *   8. Solo tras éxito, registra PUBLISH_RESULT en audit_logs.
 *
 * Política de quorum:
 *   turnoutPercentage >= minTurnoutPercentage
 * Si no hay election_rules, se asume min_turnout = 0.
 */
export const publishElection = async (electionId, actor = {}, ipAddress = null) => {
  assertElectionId(electionId);

  // 1. Existencia y estado actual.
  const election = await electionRepository.findElectionById(electionId);
  if (!election) {
    throw ApiError.notFound(MESSAGES.ELECTION.NOT_FOUND);
  }

  if (election.status !== 'CERTIFIED') {
    throw ApiError.conflict(
      `Solo se puede publicar una elección en estado CERTIFIED. ` +
        `Estado actual: ${election.status}`
    );
  }

  // 2. Validación de quorum (específica del dominio Results).
  const rules = await electionRulesRepository.findRulesByElection(electionId);
  const minTurnout = rules ? Number(rules.minTurnoutPercentage ?? rules.min_turnout_percentage ?? 0) : 0;

  const result = await resultsRepository.findElectionResult(electionId);
  if (!result) {
    throw ApiError.conflict(
      'La elección certificada no tiene acta de resultados. ' +
        'Ejecute la certificación primero.'
    );
  }

  // Lectura segura con fallback camelCase / snake_case para evitar NaN (Solución Bug C5)
  const turnout = Number(result.turnoutPercentage ?? result.turnout_percentage ?? 0);

  if (Number.isNaN(turnout) || turnout < minTurnout) {
    throw ApiError.conflict(
      `No se cumple el quórum requerido. ` +
        `Turnout actual: ${Number.isNaN(turnout) ? 0 : turnout.toFixed(2)}%, ` +
        `mínimo requerido: ${minTurnout.toFixed(2)}%.`
    );
  }

  // 3. Cambio de estado via la capa de servicio (conserva reglas).
  const published = await electionService.changeStatus(
    electionId,
    'PUBLISHED'
  );

  // 4. Solo tras éxito, registrar audit.
  await auditService.logAction({
    actorId: actor.userId ?? actor.id ?? null,
    electionId,
    action: AUDIT_ACTIONS.PUBLISH_RESULT,
    ipAddress,
    metadata: {
      turnout_percentage: turnout,
      min_turnout_percentage: minTurnout,
      quorum_met: true,
      source: 'results.publication',
    },
  });

  return published;
};

export default {
  publishElection,
};