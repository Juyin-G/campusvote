// src/modules/fairResults/fairResult.service.js
// Resultados de proyectos de FERIAS (dominio exclusivo de ferias; NO mezcla
// con el dominio electoral electoral/results).
//
// Cálculo DERIVADO (sin tablas ni duplicación):
//   Se obtiene de BD:
//     - Fair (fuente de verdad del tenant y del estado)
//     - Proyectos APPROVED de esa feria (Project)
//     - FairEvaluation.total_score (una por triada fair + project + jury)
//   El promedio/average_score se calcula SIEMPRE en el servidor a partir de
//   los total_score de las evaluaciones en BD. Nunca se confía en datos del
//   cliente (fair_id alternativo, rubric_id, criterion_id, average_score,
//   ranking o winner): el schema solo admite el id de la feria en la ruta.
//
// Reglas del ranking:
//   1. promedio (average_score) DESC
//   2. cantidad de evaluaciones (evaluation_count) DESC
//   3. desempate determinista final: project.id ASC
//   (sin orden aleatorio; sin reglas de desempate adicionales).
//
// Proyectos sin evaluaciones:
//   - aparecen en la consulta administrativa al final del listado;
//   - average_score = null y evaluation_count = 0 (NO se inventa un 0);
//   - position = null (NUNCA una posición válida de ganador);
//   - winner = false.
//
// Ganador:
//   - Solo existe cuando fair.status = CLOSED y los resultados fueron
//     publicados (publicación oficial persistida en fair_result_publications).
//   - winner = true únicamente para position === 1 de una feria CLOSED cuyo
//     estado "published" sea true. ANTES de publicar, winner siempre false.
//   - Solo proyectos APPROVED que tengan evaluaciones pueden ganar.
//   - En DRAFT/OPEN NO existe ganador definitivo (winner siempre false).
//   - No se agrega estado WINNER a Project (el ganador se deriva del ranking)
//     y NO se persiste ningún ganador (la publicación solo guarda fair +
//     published_by + timestamps).
//
// Precisión:
//   - total_score viene de PostgreSQL como NUMERIC(10,2) (Decimal de Prisma).
//   - Se convierte a centésimas (enteros) para sumar/ordenar EXACTAMENTE
//     (evita errores de punto flotante de JS). average_score se redondea a
//     2 decimales (Math.round, half-up) y se devuelve como Number legible
//     p. ej. 18.75 (nunca la representación interna del Decimal).

import * as resultRepository from './fairResult.repository.js';
import * as fairRepository from '../fairs/fair.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';

const loadFair = async (fairId) => {
  const fair = await fairRepository.findById(fairId);
  if (!fair) {
    throw ApiError.notFound('Feria no encontrada');
  }
  return fair;
};

/**
 * Tenant: ADMIN de la organización dueña de la feria es el único autorizado
 * a consultar/publicar sus resultados. El router ya bloquea a SUPERADMIN
 * antes de llegar al service (sin bypass aunque tenga organizationId).
 */
const assertTenantMatch = ({ fair, actor }) => {
  if (!actor.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }
  if (fair.organizationId !== actor.organizationId) {
    throw ApiError.forbidden('La feria no pertenece a tu organización');
  }
};

// ════════════════════════════════════════════════════════════════════
// LÓGICA PURA DE CÁLCULO (exportada para tests unitarios sin BD)
// ════════════════════════════════════════════════════════════════════

/** Convierte un total a centésimas enteras (resuelve Decimal de Prisma). */
const toHundredths = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
};

/**
 * Estadísticas de un proyecto a partir de los total_score de sus evaluaciones.
 * @param {Array<number|Decimal>} totals - total_score de cada evaluación.
 */
export const computeProjectStats = (totals) => {
  const evaluationCount = totals.length;
  if (evaluationCount === 0) {
    return { evaluationCount: 0, averageScore: null, averageHundredths: null };
  }
  const sumHundredths = totals.reduce((acc, t) => acc + toHundredths(t), 0);
  const averageHundredths = Math.round(sumHundredths / evaluationCount);
  return {
    evaluationCount,
    averageScore: averageHundredths / 100,
    averageHundredths,
  };
};

/**
 * Construye el ranking completo de la feria (determinista).
 *
 * @param {Object} args
 * @param {string} args.status - fair.status ('DRAFT' | 'OPEN' | 'CLOSED').
 * @param {boolean} [args.published=false] - true si la feria ya publicó sus
 *   resultados (winner requiere CLOSED + published + position 1).
 * @param {Array<{id: string, name: string}>} args.projects - proyectos APPROVED.
 * @param {Map<string, Array>} args.evaluationsByProject - projectId -> totals.
 */
export const buildFairRanking = ({
  status,
  published = false,
  projects,
  evaluationsByProject = new Map(),
}) => {
  const evaluated = [];
  const unevaluated = [];

  for (const project of projects) {
    const totals = evaluationsByProject.get(project.id) ?? [];
    const stats = computeProjectStats(totals);
    if (stats.evaluationCount > 0) {
      evaluated.push({ project, ...stats });
    } else {
      unevaluated.push(project);
    }
  }

  evaluated.sort((a, b) => {
    if (b.averageHundredths !== a.averageHundredths) {
      return b.averageHundredths - a.averageHundredths;
    }
    if (b.evaluationCount !== a.evaluationCount) {
      return b.evaluationCount - a.evaluationCount;
    }
    return a.project.id.localeCompare(b.project.id);
  });

  const ranking = evaluated.map((entry, index) => {
    const position = index + 1;
    return {
      position,
      project_id: entry.project.id,
      project_name: entry.project.name,
      average_score: entry.averageScore,
      evaluation_count: entry.evaluationCount,
      winner: published && status === 'CLOSED' && position === 1,
    };
  });

  // Proyectos APPROVED sin evaluaciones: aparecen (consulta administrativa),
  // pero sin posición válida y sin promedio inventado.
  for (const project of unevaluated) {
    ranking.push({
      position: null,
      project_id: project.id,
      project_name: project.name,
      average_score: null,
      evaluation_count: 0,
      winner: false,
    });
  }

  return ranking;
};

// ════════════════════════════════════════════════════════════════════
// OPERACIÓN
// ════════════════════════════════════════════════════════════════════

const mapPublishedBy = (publication) =>
  publication?.publishedBy
    ? {
        id: publication.publishedBy.id,
        first_name: publication.publishedBy.firstName,
        last_name: publication.publishedBy.lastName,
      }
    : null;

/**
 * GET /api/fairs/:id/results — Resultados de una feria (ADMIN).
 * Ranking derivado de las evaluaciones reales; winner solo si la feria está
 * CLOSED Y publicada (published). Incluye publicado/cuándo/quién.
 */
export const getFairResults = async ({ fairId, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });

  const [projects, evaluations, publication] = await Promise.all([
    resultRepository.listApprovedProjects(fairId),
    resultRepository.listEvaluationTotals(fairId),
    resultRepository.findPublicationByFair(fairId),
  ]);

  const evaluationsByProject = new Map();
  for (const evaluation of evaluations) {
    const totals = evaluationsByProject.get(evaluation.projectId) ?? [];
    totals.push(evaluation.totalScore);
    evaluationsByProject.set(evaluation.projectId, totals);
  }

  const ranking = buildFairRanking({
    status: fair.status,
    published: Boolean(publication),
    projects,
    evaluationsByProject,
  });

  return {
    fair_id: fair.id,
    fair_name: fair.name,
    fair_status: fair.status,
    published: Boolean(publication),
    published_at: publication?.createdAt ?? null,
    published_by: mapPublishedBy(publication),
    ranking,
  };
};

/**
 * POST /api/fairs/:id/results/publish — Publica oficialmente los resultados
 * (ADMIN). Persistencia MÍNIMA (fair_result_publications): el
 * ranking/ganador/promedio se siguen derivando en el backend. Solo ferias
 * CLOSED; máximo una publicación por feria (409 si ya fue publicada).
 */
export const publishFairResults = async ({ fairId, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });

  if (fair.status !== 'CLOSED') {
    throw ApiError.conflict('Los resultados solo se publican cuando la feria está cerrada (CLOSED)');
  }

  const existing = await resultRepository.findPublicationByFair(fairId);
  if (existing) {
    throw ApiError.conflict('Los resultados de esta feria ya fueron publicados');
  }

  let publication;
  try {
    publication = await resultRepository.createPublication({
      fairId,
      publishedById: actor.id,
    });
  } catch (err) {
    if (err.message === 'FAIR_RESULT_ALREADY_PUBLISHED') {
      throw ApiError.conflict('Los resultados de esta feria ya fueron publicados');
    }
    throw err;
  }

  return {
    fair_id: fair.id,
    fair_name: fair.name,
    fair_status: fair.status,
    published: true,
    published_at: publication.createdAt,
    published_by: mapPublishedBy(publication),
  };
};

export default {
  getFairResults,
  publishFairResults,
  computeProjectStats,
  buildFairRanking,
};