// src/modules/results/tally/tally.service.js
// S7-01 — Servicio de recálculo y consulta de tallies.
//
// Responsabilidades:
//   - Coordinar el caso de uso de recálculo de tallies.
//   - Validar existencia y estado de la elección.
//   - Construir el set de registros a persistir (incluye 0 votos).
//   - Delegar el acceso a datos a tally.repository.js.
//   - Traducir errores a ApiError.
//
// NO accede a Prisma directamente.
// NO escribe en election_results (responsabilidad de FASE 7).
// NO conoce HTTP.

import * as electionRepository from '../../elections/elections/election.repository.js';
import * as tallyRepository from './tally.repository.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import MESSAGES from '../../../constants/messages.js';

// Estados válidos para recalcular el conteo.
const RECALCULABLE_STATUS = 'CLOSED';

// ─────────────────────────────────────────────────────────────
// HELPERS PRIVADOS
// ─────────────────────────────────────────────────────────────

/**
 * Construye los registros de tally a persistir a partir de las
 * ballot_options y los conteos de vote_selections.
 *
 * Garantías:
 *   - Toda ballot_option de la elección aparece como record,
 *     aunque su votes_count sea 0.
 *   - BLANK y NULL se tratan como ballot_options normales.
 *   - Si un ballot_option_id aparece en counts pero no existe
 *     en ballotOptions (huérfano por FK rota), se ignora.
 */
const buildTallyRecords = (electionId, ballotOptions, counts) => {
  const countsMap = new Map(
    counts.map((c) => [c.ballotOptionId, c._count._all])
  );

  return ballotOptions.map((opt) => ({
    electionId,
    positionId: opt.ballotPosition.positionId,
    optionId: opt.id,
    votesCount: countsMap.get(opt.id) ?? 0,
  }));
};

/** Cuenta cuántos valores únicos tiene un array por una clave. */
const countUnique = (records, key) => {
  const set = new Set();
  for (const r of records) set.add(r[key]);
  return set.size;
};

const assertElectionId = (electionId) => {
  if (!electionId || typeof electionId !== 'string') {
    throw ApiError.badRequest('El ID de la elección es requerido');
  }
};

// ─────────────────────────────────────────────────────────────
// CASO DE USO: RECÁLCULO
// ─────────────────────────────────────────────────────────────

/**
 * Recalcula los tallies de una elección CERRADA.
 *
 * Flujo:
 *   1. Valida el electionId.
 *   2. Verifica que la elección exista.
 *   3. Verifica que su estado sea CLOSED.
 *   4. Lee ballot_options y conteos de vote_selections.
 *   5. Construye los records (incluyendo opciones con 0 votos).
 *   6. Sustituye atómicamente los tallies anteriores.
 *
 * Idempotencia garantizada por:
 *   - tallyRepository.replaceTallies (deleteMany + createMany
 *     en $transaction, sin skipDuplicates).
 *   - El conteo depende solo de vote_selections, que tiene
 *     UNIQUE(vote_id, ballot_option_id).
 */
export const recalculateTallies = async (electionId) => {
  assertElectionId(electionId);

  const election = await electionRepository.findElectionById(electionId);

  if (!election) {
    throw ApiError.notFound(MESSAGES.ELECTION.NOT_FOUND);
  }

  if (election.status !== RECALCULABLE_STATUS) {
    throw ApiError.conflict(
      `Solo se puede recalcular el conteo de una elección en estado ${RECALCULABLE_STATUS}. ` +
        `Estado actual: ${election.status}`
    );
  }

  const [ballotOptions, counts] = await Promise.all([
    tallyRepository.findBallotOptionsByElection(electionId),
    tallyRepository.countSelectionsByBallotOption(electionId),
  ]);

  const records = buildTallyRecords(electionId, ballotOptions, counts);

  const result = await tallyRepository.replaceTallies(
    electionId,
    records
  );

  return {
    electionId,
    deleted: result.deleted,
    inserted: result.inserted,
    optionsProcessed: records.length,
    positionsProcessed: countUnique(records, 'positionId'),
  };
};

// ─────────────────────────────────────────────────────────────
// CASO DE USO: CONSULTA
// ─────────────────────────────────────────────────────────────

/**
 * Devuelve los tallies ya almacenados para una elección.
 * Si la elección no existe, devuelve un array vacío.
 */
export const getExistingTallies = async (electionId) => {
  assertElectionId(electionId);
  return tallyRepository.findExistingTallies(electionId);
};

// ─────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────

export default {
  recalculateTallies,
  getExistingTallies,
};
