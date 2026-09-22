import * as fairResultRepository from './fairResult.repository.js';

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

    const projects = await fairResultRepository.listApprovedProjects(fairId);

    // Mapeo e independización de promedio y conteo de evaluaciones
    const mappedRanking = projects.map((project) => {
      const evaluationCount = project.evaluations.length;

      if (evaluationCount === 0) {
        return {
          project_id: project.id,
          name: project.name,
          average_score: null,
          evaluation_count: 0,
          position: null,
          winner: false,
        };
      }

      const totalSum = project.evaluations.reduce((acc, curr) => acc + Number(curr.totalScore || 0), 0);
      const averageScore = Math.round((totalSum / evaluationCount) * 100) / 100;

      return {
        project_id: project.id,
        name: project.name,
        average_score: averageScore,
        evaluation_count: evaluationCount,
        position: null,
        winner: false,
      };
    });

    const evaluated = mappedRanking.filter((item) => item.average_score !== null);
    const unevaluated = mappedRanking.filter((item) => item.average_score === null);

    // Algoritmo de Ordenamiento Determinista:
    // 1. average_score DESC
    // 2. evaluation_count DESC
    // 3. project_id ASC
    evaluated.sort((a, b) => {
      if (b.average_score !== a.average_score) {
        return b.average_score - a.average_score;
      }
      if (b.evaluation_count !== a.evaluation_count) {
        return b.evaluation_count - a.evaluation_count;
      }
      return a.project_id.localeCompare(b.project_id);
    });

    // Asignación de Posición y regla de Ganador (winner solo si isPublished === true)
    evaluated.forEach((item, index) => {
      item.position = index + 1;
      if (isPublished && item.position === 1) {
        item.winner = true;
      }
    });

    const finalRanking = [...evaluated, ...unevaluated];

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
      publishedById: currentUser.id,
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

    const assignment = await fairResultRepository.findJuryAssignment(fairId, currentUser.id);
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