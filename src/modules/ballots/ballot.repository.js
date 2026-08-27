// src/modules/ballots/ballot.repository.js


import { prisma } from '../../database/prisma.js';

const BALLOT_SELECT = {
  id: true,
  electionId: true,
  version: true,
  isActive: true,
  generatedAt: true,
  createdAt: true,
  updatedAt: true,
};

export const findBallotById = (id) =>
  prisma.ballots.findUnique({
    where: { id },
    select: BALLOT_SELECT,
  });

export const listBallotsByElection = (
  electionId,
  { skip = 0, take = 10 } = {},
) =>
  prisma.ballots.findMany({
    where: {
      electionId,
    },
    select: BALLOT_SELECT,
    orderBy: {
      version: 'desc',
    },
    skip,
    take,
  });

export const countBallotsByElection = (electionId) =>
  prisma.ballots.count({
    where: {
      electionId,
    },
  });

export const createBallot = (data) =>
  prisma.ballots.create({
    data,
    select: BALLOT_SELECT,
  });

export const updateBallot = (id, data) =>
  prisma.ballots.update({
    where: { id },
    data,
    select: BALLOT_SELECT,
  });

export const deleteBallotById = (id) =>
  prisma.ballots.delete({
    where: { id },
    select: {
      id: true,
    },
  });

/**
 * Obtiene la boleta activa de una elección usando
 * la función SQL get_active_ballot().
 */
export const getActiveBallot = async (electionId) => {
  const result = await prisma.$queryRaw`
    SELECT 
      ballot_id AS "id",
      version,
      generated_at AS "generatedAt"
    FROM get_active_ballot(${electionId}::uuid)
  `;

  return result[0] ?? null;
};

/**
 * Crea una nueva versión de la boleta.
 * La función SQL desactiva la versión activa anterior
 * y genera automáticamente la siguiente versión.
 */
export const createBallotVersion = async (electionId) => {
  const result = await prisma.$queryRaw`
    SELECT create_ballot_version(${electionId}::uuid) AS ballot_id
  `;

  const ballotId = result[0]?.ballot_id ?? null;

  if (!ballotId) {
    return null;
  }

  return findBallotById(ballotId);
};

/**
 * Valida que todas las posiciones de la boleta
 * tengan al menos una opción.
 */
export const validateBallotCompleteness = async (ballotId) => {
  const result = await prisma.$queryRaw`
    SELECT validate_ballot_completeness(${ballotId}::uuid) AS is_complete
  `;

  return result[0]?.is_complete ?? false;
};

export default {
  findBallotById,
  listBallotsByElection,
  countBallotsByElection,
  createBallot,
  updateBallot,
  deleteBallotById,
  getActiveBallot,
  createBallotVersion,
  validateBallotCompleteness,
};