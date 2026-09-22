// src/modules/fairVoting/fairVoting.repository.js
// Acceso a datos (Prisma) de la VOTACIÓN ANÓNIMA de FERIAS.
// Solo traducción Prisma ↔ SQL — sin reglas de negocio.

import { prisma } from '../../database/prisma.js';
import { Prisma } from '@prisma/client';

const PARTICIPATION_SELECT = {
  id: true,
  fairId: true,
  juryUserId: true,
  votedAt: true,
  createdAt: true,
  updatedAt: true,
};

const VOTE_SELECT = {
  id: true,
  fairId: true,
  projectId: true,
  receiptCode: true,
  createdAt: true,
  updatedAt: true,
};

// ── Participación ─────────────────────────────────────────────────

export const findParticipation = (fairId, juryUserId) =>
  prisma.fairVoteParticipation.findUnique({
    where: { fairId_juryUserId: { fairId, juryUserId } },
    select: PARTICIPATION_SELECT,
  });

export const createParticipation = (data) =>
  prisma.fairVoteParticipation.create({ data, select: PARTICIPATION_SELECT });

// ── Voto ──────────────────────────────────────────────────────────

export const createVote = (data) =>
  prisma.fairVote.create({ data, select: VOTE_SELECT });

export const findVoteByReceipt = (fairId, receiptCode) =>
  prisma.fairVote.findUnique({
    where: { fairId_receiptCode: { fairId, receiptCode } },
    select: VOTE_SELECT,
  });

// ── Conteos / resultados (derivados) ─────────────────────────────

/** Lista TODOS los proyectos APPROVED de la feria (fuente de verdad del ranking). */
export const listApprovedProjects = (fairId) =>
  prisma.project.findMany({
    where: { fairId, status: 'APPROVED' },
    select: {
      id: true,
      fairId: true,
      name: true,
      status: true,
      categoryId: true,
      category: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

/** Conteo de votos por proyecto en una feria. */
export const countVotesByFair = async (fairId) => {
  const grouped = await prisma.fairVote.groupBy({
    by: ['projectId'],
    where: { fairId },
    _count: { _all: true },
  });
  return new Map(grouped.map((g) => [g.projectId, g._count._all]));
};

/** Total de votos emitidos en la feria. */
export const countTotalVotes = (fairId) =>
  prisma.fairVote.count({ where: { fairId } });

// ── Traducción de errores Prisma a errores de dominio ────────────

export const handlePrismaError = (error) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') throw new Error('FAIR_VOTE_ALREADY_VOTED');
    if (error.code === 'P2003') throw new Error('FAIR_VOTE_FOREIGN_KEY');
  }
  throw error;
};

export default {
  findParticipation,
  createParticipation,
  createVote,
  findVoteByReceipt,
  listApprovedProjects,
  countVotesByFair,
  countTotalVotes,
  handlePrismaError,
};
