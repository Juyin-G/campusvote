import * as fairResultRepository from './fairResult.repository.js';
import { buildVoteRanking as rankByVotes } from '../fairVoting/fairVoting.helpers.js';

/**
 * Ranking de la feria por votos del jurado, con el ganador oficial marcado.
 * Lo usan los certificados (certificate.eligibility.service.js) y lo describe
 * tests/unit/fairResults/fairResult.ranking.test.js.
 *
 * - Orden: votos DESC y, en empate, project_id ASC (determinista).
 * - Proyectos sin votos van al final con position = null.
 * - winner = true solo en position 1, con la feria CLOSED y los resultados
 *   publicados: antes de eso no hay ganador oficial.
 */
export const buildVoteRanking = ({ status, published = false, projects, votesByProject }) => {
  const official = status === 'CLOSED' && Boolean(published);
  return rankByVotes(projects, votesByProject).map((entry) => ({
    ...entry,
    winner: official && entry.position === 1,
  }));
};

export class FairResultsService {
  /**
   * Obtiene los resultados y el ranking ordenado de los proyectos aprobados.
   */
  static async getResults(fairId, currentUser) {
    const fair = await fairResultRepository.findFairById(fairId);

    if (!fair) {
      const error = new Error('Feria no encontrada');
      error.statusCode = 404;
      throw error;
    }

    // Validación Multi-Tenant estricta (ADMIN y SUPERADMIN no cruzan frontera ORG)
    if (fair.organizationId !== currentUser.organizationId) {
      const error = new Error('No tiene permisos para acceder a esta organización');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    const publication = await fairResultRepository.findPublicationByFair(fairId);
    const isPublished = Boolean(publication);

    // Ranking por VOTOS del jurado (fair_votes). Antes se promediaba
    // fair_evaluations.total_score, columna que 012a eliminó al pasar la
    // rúbrica a checklist: la consulta fallaba y /results respondía 400.
    const [projects, votesByProject] = await Promise.all([
      fairResultRepository.listApprovedProjects(fairId),
      fairResultRepository.countVotesByProject(fairId),
    ]);
    const finalRanking = buildVoteRanking({
      status: fair.status,
      published: isPublished,
      projects,
      votesByProject,
    }).map((entry) => ({ ...entry, name: entry.project_name }));

    return {
      fair_id: fair.id,
      fair_status: fair.status,
      published: isPublished,
      published_at: publication?.createdAt ? publication.createdAt.toISOString() : null,
      published_by: publication?.publishedBy
        ? {
            id: publication.publishedBy.id,
            first_name: publication.publishedBy.firstName,
            last_name: publication.publishedBy.lastName,
          }
        : null,
      ranking: finalRanking,
    };
  }

  /**
   * Publica oficialmente los resultados de una feria en estado CLOSED.
   */
  static async publishResults(fairId, currentUser) {
    const fair = await fairResultRepository.findFairById(fairId);

    if (!fair) {
      const error = new Error('Feria no encontrada');
      error.statusCode = 404;
      throw error;
    }

    // Validación Multi-Tenant
    if (fair.organizationId !== currentUser.organizationId) {
      const error = new Error('No tiene permisos para publicar en esta organización');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    // Regla: Solo ferias CERRADAS pueden publicarse
    if (fair.status !== 'CLOSED') {
      const error = new Error('Solo se pueden publicar resultados de ferias cerradas');
      error.statusCode = 409;
      throw error;
    }

    // Regla: Prevenir doble publicación
    const existingPub = await fairResultRepository.findPublicationByFair(fairId);
    if (existingPub) {
      const error = new Error('Los resultados ya han sido publicados anteriormente');
      error.statusCode = 409;
      throw error;
    }

    const created = await fairResultRepository.createPublication({
      fairId,
      // req.user es el JWT decodificado: el id viene en userId.
      publishedById: currentUser.userId ?? currentUser.id,
    });

    return {
      published: true,
      published_at: created.createdAt.toISOString(),
      published_by: {
        id: created.publishedBy.id,
        first_name: created.publishedBy.firstName,
        last_name: created.publishedBy.lastName,
      },
    };
  }

  /**
   * Obtiene la revisión de un proyecto exclusivo para el rol JURY.
   */
  static async getProjectReviewForJury(fairId, projectId, currentUser) {
    if (currentUser.role !== 'JURY') {
      const error = new Error('Endpoint exclusivo para rol JURY');
      error.statusCode = 403;
      throw error;
    }

    const assignment = await fairResultRepository.findJuryAssignment(fairId, currentUser.userId ?? currentUser.id);
    if (!assignment) {
      const error = new Error('El jurado no tiene asignación en esta feria');
      error.statusCode = 403;
      throw error;
    }

    const project = await fairResultRepository.findProjectForJuryReview(fairId, projectId);
    if (!project) {
      const error = new Error('Proyecto no encontrado o no cumple con el estado APPROVED en esta feria');
      error.statusCode = 404;
      throw error;
    }

    return {
      project_id: project.id,
      name: project.name,
      fair_id: project.fairId,
      logo_url: project.logoUrl ?? null,
      cover_url: project.coverUrl ?? null,
      project_url: project.projectUrl ?? null,
      description: project.description ?? null,
      members: project.members.map((member) => ({
        id: member.id,
        role: member.role,
        first_name: member.user?.firstName ?? null,
        last_name: member.user?.lastName ?? null,
      })),
    };
  }
}