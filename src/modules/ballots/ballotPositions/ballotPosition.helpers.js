// src/modules/ballots/ballotPositions/ballotPosition.helpers.js
// Helpers del módulo ballotPositions.

import { ApiError } from '../../../shared/errors/ApiError.js';
import { prisma } from '../../../database/prisma.js';

export const requireBallot = async (ballotId) => {
  const ballot = await prisma.ballot.findUnique({
    where: { id: ballotId },
    select: { id: true, electionId: true },
  });
  if (!ballot) throw ApiError.notFound('Ballot no encontrado');
  return ballot;
};

export const requirePosition = async (ballotId, positionId) => {
  const position = await prisma.ballotPosition.findFirst({
    where: { id: positionId, ballotId },
  });
  if (!position) throw ApiError.notFound('Cargo no encontrado en este ballot');
  return position;
};

export const requireCandidateListInElection = async (positionId, electionId) => {
  const position = await prisma.position.findUnique({
    where: { id: positionId },
    select: { id: true, electionId: true },
  });
  if (!position) throw ApiError.badRequest('El cargo académico no existe');
  if (position.electionId !== electionId) {
    throw ApiError.badRequest('El cargo académico no pertenece a la elección del ballot');
  }
  return position;
};

export const translatePrismaError = (err) => {
  if (err?.code === 'P2025') throw ApiError.notFound('Recurso no encontrado');
  if (err?.code === 'P2002') throw ApiError.conflict('Recurso duplicado');
  if (err?.code === 'P2003') throw ApiError.badRequest('Referencia inválida');
  throw err;
};
