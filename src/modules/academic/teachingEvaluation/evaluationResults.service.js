import { prisma } from '../../../database/prisma.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { ROLES } from '../../../constants/roles.js';
import {
  MINIMUM_RESPONSES,
  enforceMinimumResponses,
} from './evaluationResponse.service.js';

// ============================================================
// HELPERS
// ============================================================

const isAdmin = (actor) => [ROLES.ADMIN, ROLES.SUPERADMIN].includes(actor.role);

const validateTeacherAccess = async (teacherId, actor) => {
  if (actor.role === ROLES.TEACHER) {
    if (actor.id !== teacherId) {
      throw ApiError.forbidden('No puedes consultar resultados de otro docente');
    }
  } else if (!isAdmin(actor)) {
    throw ApiError.forbidden('No tienes permisos para consultar resultados');
  }

  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    select: { id: true, role: true, organizationId: true },
  });

  if (!teacher || teacher.role !== ROLES.TEACHER) {
    throw ApiError.notFound('Docente no encontrado');
  }

  if (actor.role !== ROLES.SUPERADMIN && teacher.organizationId !== actor.organizationId) {
    throw ApiError.forbidden('El docente no pertenece a tu organización');
  }

  return teacher;
};

const buildBaseWhere = (teacherId, actor, { academicPeriodId, courseId } = {}) => ({
  teachingAssignment: {
    teacherId,
    ...(actor.role !== ROLES.SUPERADMIN ? { organizationId: actor.organizationId } : {}),
    ...(academicPeriodId ? { academicPeriodId } : {}),
    ...(courseId ? { courseId } : {}),
  },
  status: 'SUBMITTED',
});

// ============================================================
// RESumen general del docente
// ============================================================

export const getTeacherSummary = async (teacherId, actor, filters = {}) => {
  await validateTeacherAccess(teacherId, actor);

  const where = buildBaseWhere(teacherId, actor, filters);

  const [responseAgg, perCourseGroup] = await Promise.all([
    prisma.evaluationResponse.aggregate({
      where,
      _avg: { _all: true },
      _count: { _all: true },
    }),
    prisma.evaluationResponse.groupBy({
      by: ['teachingAssignmentId'],
      where,
      _avg: { _all: true },
      _count: { _all: true },
    }),
  ]);

  const totalResponses = responseAgg._count?._all ?? 0;

  if (totalResponses < MINIMUM_RESPONSES) {
    return enforceMinimumResponses(null, totalResponses);
  }

  const overallAverage = Number(responseAgg._avg?._all ?? 0);

  const assignmentIds = perCourseGroup.map((g) => g.teachingAssignmentId);
  const assignments = await prisma.teachingAssignment.findMany({
    where: { id: { in: assignmentIds } },
    select: {
      id: true,
      courseId: true,
      academicPeriodId: true,
      cycle: true,
      course: { select: { id: true, code: true, name: true } },
      academicPeriod: { select: { id: true, name: true } },
    },
  });
  const assignmentMap = new Map(assignments.map((a) => [a.id, a]));

  const byCourse = perCourseGroup
    .map((g) => {
      const assignment = assignmentMap.get(g.teachingAssignmentId);
      return {
        courseId: assignment?.courseId ?? null,
        academicPeriodId: assignment?.academicPeriodId ?? null,
        cycle: assignment?.cycle ?? null,
        averageScore: Number(g._avg?._all ?? 0),
        totalResponses: g._count?._all ?? 0,
        course: assignment?.course ?? null,
        academicPeriod: assignment?.academicPeriod ?? null,
      };
    })
    .sort((a, b) => b.averageScore - a.averageScore);

  return {
    data: {
      teacherId,
      overallAverage,
      totalResponses,
      byCourse,
    },
    meta: {
      total_responses: totalResponses,
      minimum_required: MINIMUM_RESPONSES,
      insufficient_data: false,
    },
  };
};

// ============================================================
// Promedio por criterio
// ============================================================

export const getCriterionAverages = async (teacherId, actor, filters = {}) => {
  await validateTeacherAccess(teacherId, actor);

  const where = {
    evaluationResponse: buildBaseWhere(teacherId, actor, filters),
  };

  const [criterionGroup, totalResponsesAgg] = await Promise.all([
    prisma.evaluationResponseDetail.groupBy({
      by: ['criterionId'],
      where,
      _avg: { score: true },
      _count: { _all: true },
    }),
    prisma.evaluationResponse.aggregate({
      where: buildBaseWhere(teacherId, actor, filters),
      _count: { _all: true },
    }),
  ]);

  const totalResponses = totalResponsesAgg._count?._all ?? 0;

  if (totalResponses < MINIMUM_RESPONSES) {
    return enforceMinimumResponses(null, totalResponses);
  }

  const criterionIds = criterionGroup.map((g) => g.criterionId);
  const criteria = await prisma.evaluationCriterion.findMany({
    where: { id: { in: criterionIds } },
    select: { id: true, name: true, description: true, isActive: true },
  });
  const criterionMap = new Map(criteria.map((c) => [c.id, c]));

  const byCriterion = criterionGroup
    .map((g) => {
      const criterion = criterionMap.get(g.criterionId);
      return {
        criterionId: g.criterionId,
        name: criterion?.name ?? null,
        description: criterion?.description ?? null,
        isActive: criterion?.isActive ?? null,
        averageScore: Number(g._avg?.score ?? 0),
        totalScores: g._count?._all ?? 0,
      };
    })
    .sort((a, b) => b.averageScore - a.averageScore);

  return {
    data: {
      teacherId,
      totalResponses,
      byCriterion,
    },
    meta: {
      total_responses: totalResponses,
      minimum_required: MINIMUM_RESPONSES,
      insufficient_data: false,
    },
  };
};

// ============================================================
// Distribución de scores
// ============================================================

export const getScoreDistribution = async (teacherId, actor, filters = {}) => {
  await validateTeacherAccess(teacherId, actor);

  const where = {
    evaluationResponse: buildBaseWhere(teacherId, actor, filters),
  };

  const [distGroup, totalResponsesAgg] = await Promise.all([
    prisma.evaluationResponseDetail.groupBy({
      by: ['score'],
      where,
      _count: { _all: true },
    }),
    prisma.evaluationResponse.aggregate({
      where: buildBaseWhere(teacherId, actor, filters),
      _count: { _all: true },
    }),
  ]);

  const totalResponses = totalResponsesAgg._count?._all ?? 0;

  if (totalResponses < MINIMUM_RESPONSES) {
    return enforceMinimumResponses(null, totalResponses);
  }

  const distMap = new Map(distGroup.map((d) => [d.score, d._count._all]));
  const distribution = [5, 4, 3, 2, 1].map((score) => ({
    score,
    count: distMap.get(score) ?? 0,
  }));

  return {
    data: {
      teacherId,
      totalResponses,
      distribution,
    },
    meta: {
      total_responses: totalResponses,
      minimum_required: MINIMUM_RESPONSES,
      insufficient_data: false,
    },
  };
};

// ============================================================
// Comentarios anónimos
// ============================================================

export const getAnonymousComments = async (teacherId, actor, filters = {}) => {
  await validateTeacherAccess(teacherId, actor);

  const where = {
    ...buildBaseWhere(teacherId, actor, filters),
    comment: { not: null },
  };

  const [comments, totalResponsesAgg] = await Promise.all([
    prisma.evaluationResponse.findMany({
      where,
      select: { comment: true },
      orderBy: { submittedAt: 'desc' },
    }),
    prisma.evaluationResponse.aggregate({
      where: buildBaseWhere(teacherId, actor, filters),
      _count: { _all: true },
    }),
  ]);

  const totalResponses = totalResponsesAgg._count?._all ?? 0;

  if (totalResponses < MINIMUM_RESPONSES) {
    return enforceMinimumResponses(null, totalResponses);
  }

  const sanitized = comments
    .map((r) => r.comment)
    .filter((c) => c && c.trim().length > 0);

  return {
    data: {
      teacherId,
      totalResponses,
      comments: sanitized,
    },
    meta: {
      total_responses: totalResponses,
      minimum_required: MINIMUM_RESPONSES,
      insufficient_data: false,
    },
  };
};

// ============================================================
// Evolución por periodo académico
// ============================================================

export const getScoreEvolution = async (teacherId, actor, filters = {}) => {
  await validateTeacherAccess(teacherId, actor);

  const baseWhere = {
    teachingAssignment: {
      teacherId,
      ...(actor.role !== ROLES.SUPERADMIN ? { organizationId: actor.organizationId } : {}),
      ...(filters.courseId ? { courseId: filters.courseId } : {}),
    },
    status: 'SUBMITTED',
  };

  const [periodGroup, totalResponsesAgg] = await Promise.all([
    prisma.evaluationResponse.groupBy({
      by: ['teachingAssignmentId'],
      where: baseWhere,
      _avg: { _all: true },
      _count: { _all: true },
    }),
    prisma.evaluationResponse.aggregate({
      where: baseWhere,
      _count: { _all: true },
    }),
  ]);

  const totalResponses = totalResponsesAgg._count?._all ?? 0;

  if (totalResponses < MINIMUM_RESPONSES) {
    return enforceMinimumResponses(null, totalResponses);
  }

  const assignmentIds = periodGroup.map((g) => g.teachingAssignmentId);
  const assignments = await prisma.teachingAssignment.findMany({
    where: { id: { in: assignmentIds } },
    select: {
      id: true,
      academicPeriodId: true,
      academicPeriod: { select: { id: true, name: true, startDate: true } },
    },
  });
  const assignmentMap = new Map(assignments.map((a) => [a.id, a]));

  const periodMap = new Map();
  for (const g of periodGroup) {
    const assignment = assignmentMap.get(g.teachingAssignmentId);
    if (!assignment) continue;
    const periodId = assignment.academicPeriodId;
    if (!periodMap.has(periodId)) {
      periodMap.set(periodId, {
        academicPeriodId: periodId,
        academicPeriod: assignment.academicPeriod ?? null,
        totalScore: 0,
        totalResponses: 0,
      });
    }
    const entry = periodMap.get(periodId);
    entry.totalScore += Number(g._avg?._all ?? 0) * (g._count?._all ?? 0);
    entry.totalResponses += g._count?._all ?? 0;
  }

  const evolution = Array.from(periodMap.values())
    .map((p) => ({
      academicPeriodId: p.academicPeriodId,
      academicPeriod: p.academicPeriod,
      averageScore: p.totalResponses > 0 ? Number((p.totalScore / p.totalResponses).toFixed(2)) : 0,
      totalResponses: p.totalResponses,
    }))
    .sort((a, b) => {
      const dateA = a.academicPeriod?.startDate ?? '';
      const dateB = b.academicPeriod?.startDate ?? '';
      return dateA < dateB ? -1 : dateA > dateB ? 1 : 0;
    });

  return {
    data: {
      teacherId,
      totalResponses,
      evolution,
    },
    meta: {
      total_responses: totalResponses,
      minimum_required: MINIMUM_RESPONSES,
      insufficient_data: false,
    },
  };
};
