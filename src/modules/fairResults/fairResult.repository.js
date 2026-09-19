// src/modules/fairResults/fairResult.repository.js
// Consultas derivadas para RESULTADOS de FERIAS.
// El ranking se calcula a partir de los VOTOS ANÓNIMOS (fair_votes), NO de
// las hojas de rúbrica (fair_evaluations) — esto refleja la separación:
// la rúbrica NO decide ganadores; la votación SÍ.

import { prisma } from '../../database/prisma.js';

const APPROVED = 'APPROVED';

/** Proyectos APPROVED de la feria (fuente de verdad del tenant: FAIR). */
export const listApprovedProjects = (fairId) =>
  prisma.project.findMany({
    where: { fairId, status: APPROVED },
    select: { id: true, fairId: true, name: true, status: true },
    orderBy: { createdAt: 'asc' },
  });

/**
 * Conteo de votos por proyecto en la feria.
 * (Reemplaza al antiguo `listEvaluationTotals` que leía total_score.)
 */
export const countVotesByProject = async (fairId) => {
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

// ── Publicación de resultados (persistencia mínima; ranking derivado) ─

const PUBLICATION_SELECT = {
  id: true,
  fairId: true,
  publishedById: true,
  createdAt: true,
  updatedAt: true,
  publishedBy: { select: { id: true, firstName: true, lastName: true } },
};

export const findPublicationByFair = (fairId) =>
  prisma.fairResultPublication.findUnique({ where: { fairId }, select: PUBLICATION_SELECT });

export const createPublication = async ({ fairId, publishedById }) => {
  try {
    return await prisma.fairResultPublication.create({
      data: { fairId, publishedById },
      select: PUBLICATION_SELECT,
    });
  } catch (error) {
    if (error?.code === 'P2002') throw new Error('FAIR_RESULT_ALREADY_PUBLISHED');
    throw error;
  }
};

export default {
  listApprovedProjects,
  countVotesByProject,
  countTotalVotes,
  findPublicationByFair,
  createPublication,
};
