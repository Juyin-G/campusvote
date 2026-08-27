// src/modules/results/results.repository.js
// S7-05 — Acceso a datos para resultados en vivo y finales.
// S7-04 — Acceso a election_results para validación de quórum.
//
// Responsabilidad única: lectura y persistencia de election_results
// y composición de datos para /results/live y /results/final.
//
// NO contiene reglas de negocio.
// NO conoce HTTP.

import { prisma } from '../../database/prisma.js';

const ELECTION_RESULT_SELECT = {
  id: true,
  election_id: true,
  total_voters: true,
  total_votes_cast: true,
  turnout_percentage: true,
  blank_votes: true,
  null_votes: true,
  certified_at: true,
  published_at: true,
  report_pdf: true,
  report_hash: true,
  report_signature: true,
  created_at: true,
  updated_at: true,
};

const TALLY_FULL_SELECT = {
  id: true,
  election_id: true,
  position_id: true,
  option_id: true,
  votes_count: true,
  updated_at: true,
  ballot_options: {
    select: {
      id: true,
      option_type: true,
      label: true,
      candidate_list_id: true,
      ballot_positions: {
        select: {
          position_id: true,
          positions: {
            select: {
              id: true,
              name: true,
              seats: true,
            },
          },
        },
      },
    },
  },
};

/**
 * Devuelve el acta de resultados consolidada (election_results) de
 * una elección. Si no existe, devuelve null.
 */
export const findElectionResult = (electionId) =>
  prisma.election_results.findUnique({
    where: { election_id: electionId },
    select: ELECTION_RESULT_SELECT,
  });

/**
 * Devuelve los tallies con su contexto completo: option, position,
 * ballot_position. Sirve para componer /results/live y /results/final.
 */
export const findTalliesWithContext = (electionId) =>
  prisma.tallies.findMany({
    where: { election_id: electionId },
    select: TALLY_FULL_SELECT,
    orderBy: [{ position_id: 'asc' }, { option_id: 'asc' }],
  });

/**
 * Devuelve el estado actual de una elección (solo status).
 */
export const findElectionStatus = (electionId) =>
  prisma.elections.findUnique({
    where: { id: electionId },
    select: { id: true, status: true },
  });

export default {
  findElectionResult,
  findTalliesWithContext,
  findElectionStatus,
};
