import { prisma } from '../../database/prisma.js';

const APPROVED = 'APPROVED';

/**
 * Busca una feria por su ID e incluye la organización asociada para validaciones multi-tenant.
 */
export const findFairById = (fairId) =>
  prisma.fair.findUnique({
    where: { id: fairId },
    select: {
      id: true,
      organizationId: true,
      status: true,
    },
  });

/**
 * Proyectos APPROVED de la feria con sus evaluaciones (fairEvaluations)
 * para el cálculo dinámico del promedio de ranking.
 */
export const listApprovedProjects = (fairId) =>
  prisma.project.findMany({
    where: { fairId, status: APPROVED },
    select: {
      id: true,
      fairId: true,
      name: true,
      status: true,
    },
    orderBy: { id: 'asc' },
  });

/**
 * Selección estandarizada para la publicación de resultados.
 */
const PUBLICATION_SELECT = {
  id: true,
  fairId: true,
  publishedById: true,
  createdAt: true,
  updatedAt: true,
  publishedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
};

/**
 * Busca la publicación oficial de resultados asociada a una feria.
 */
/** Votos por proyecto de la feria: Map(projectId -> cantidad). Los usan los certificados. */
export const countVotesByProject = async (fairId) => {
  const grouped = await prisma.fairVote.groupBy({
    by: ['projectId'],
    where: { fairId },
    _count: { _all: true },
  });
  return new Map(grouped.map((g) => [g.projectId, g._count._all]));
};

export const findPublicationByFair = (fairId) =>
  prisma.fairResultPublication.findUnique({
    where: { fairId },
    select: PUBLICATION_SELECT,
  });

/**
 * Registra la publicación oficial de resultados.
 */
export const createPublication = async ({ fairId, publishedById }) => {
  try {
    return await prisma.fairResultPublication.create({
      data: { fairId, publishedById },
      select: PUBLICATION_SELECT,
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      const conflictError = new Error('FAIR_RESULT_ALREADY_PUBLISHED');
      conflictError.statusCode = 409;
      throw conflictError;
    }
    throw error;
  }
};

/**
 * Busca la asignación activa de un jurado dentro de una feria.
 */
export const findJuryAssignment = (fairId, userId) =>
  prisma.fairJuryAssignment.findFirst({
    where: { fairId, userId },
  });

/**
 * Obtiene el detalle de revisión de un proyecto exclusivo para la vista del JURY.
 * Garantiza que pertenezca a la feria y que su estado sea APPROVED. Omite datos sensibles.
 */
export const findProjectForJuryReview = (fairId, projectId) =>
  prisma.project.findFirst({
    where: {
      id: projectId,
      fairId,
      status: APPROVED,
    },
    select: {
      id: true,
      name: true,
      fairId: true,
      logoUrl: true,
      coverUrl: true,
      projectUrl: true,
      description: true,
      members: {
        select: {
          id: true,
          role: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

export default {
  findFairById,
  listApprovedProjects,
  findPublicationByFair,
  createPublication,
  findJuryAssignment,
  findProjectForJuryReview,
};