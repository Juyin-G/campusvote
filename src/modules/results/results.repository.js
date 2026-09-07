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
  electionId: true,
  totalVoters: true,
  totalVotesCast: true,
  turnoutPercentage: true,
  blankVotes: true,
  nullVotes: true,
  certifiedAt: true,
  publishedAt: true,
  reportPdf: true,
  reportHash: true,
  reportSignature: true,
  createdAt: true,
  updatedAt: true,
};

const TALLY_FULL_SELECT = {
  id: true,
  electionId: true,
  positionId: true,
  optionId: true,
  votesCount: true,
  updatedAt: true,
  ballotOption: {
    select: {
      id: true,
      optionType: true,
      label: true,
      candidateListId: true,
      ballotPosition: {
        select: {
          positionId: true,
          position: {
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
  prisma.electionResult.findUnique({
    where: { electionId },
    select: ELECTION_RESULT_SELECT,
  });

/**
 * Devuelve los tallies con su contexto completo: option, position,
 * ballot_position. Sirve para componer /results/live y /results/final.
 */
export const findTalliesWithContext = (electionId) =>
  prisma.tally.findMany({
    where: { electionId },
    select: TALLY_FULL_SELECT,
    orderBy: [{ positionId: 'asc' }, { optionId: 'asc' }],
  });

/**
 * Devuelve el estado actual de una elección (solo status).
 */
export const findElectionStatus = (electionId) =>
  prisma.election.findUnique({
    where: { id: electionId },
    select: { id: true, status: true },
  });

export const findPublishedElections = () =>
  prisma.election.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      id: true,
      title: true,
      description: true,
      startAt: true,
      endAt: true,
      status: true,
      creator: {
        select: {
          organization: {
            select: {
              name: true,
              code: true,
              logo: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

export default {
  findElectionResult,
  findTalliesWithContext,
  findElectionStatus,
  findPublishedElections,
};
