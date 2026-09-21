// tests/unit/teachingEvaluation/evaluationResults.test.js
import { jest } from '@jest/globals';

const mockResponseAggregate = jest.fn();
const mockResponseFindMany = jest.fn();
const mockDetailGroupBy = jest.fn();
const mockDetailFindMany = jest.fn();
const mockAssignmentFindMany = jest.fn();
const mockCriterionFindMany = jest.fn();
const mockFindUnique = jest.fn();

jest.unstable_mockModule('../../../src/database/prisma.js', () => ({
  prisma: {
    evaluationResponse: {
      aggregate: mockResponseAggregate,
      findMany: mockResponseFindMany,
    },
    evaluationResponseDetail: {
      groupBy: mockDetailGroupBy,
      findMany: mockDetailFindMany,
    },
    evaluationCriterion: { findMany: mockCriterionFindMany },
    teachingAssignment: { findMany: mockAssignmentFindMany },
    user: { findUnique: mockFindUnique },
  },
}));

jest.unstable_mockModule('../../../src/shared/errors/ApiError.js', () => ({
  ApiError: {
    forbidden: (msg) => Object.assign(new Error(`FORBIDDEN: ${msg}`), { code: 'FORBIDDEN' }),
    notFound: (msg) => Object.assign(new Error(`NOT_FOUND: ${msg}`), { code: 'NOT_FOUND' }),
    badRequest: (msg) => Object.assign(new Error(`BAD_REQUEST: ${msg}`), { code: 'BAD_REQUEST' }),
  },
}));

const svc = await import('../../../src/modules/academic/teachingEvaluation/evaluationResults.service.js');
const { MINIMUM_RESPONSES } = await import('../../../src/modules/academic/teachingEvaluation/evaluationResponse.service.js');

const T = { id: 't1', role: 'TEACHER', organizationId: 'org1' };
const A = { id: 'a1', role: 'ADMIN', organizationId: 'org1' };
const S = { id: 's1', role: 'SUPERADMIN', organizationId: 'org2' };
const ST = { id: 'st1', role: 'STUDENT', organizationId: 'org1' };
const teacherRec = { id: 't1', role: 'TEACHER', organizationId: 'org1' };

beforeEach(() => {
  jest.clearAllMocks();
  mockFindUnique.mockResolvedValue(teacherRec);
});

// ============================================================
// getTeacherSummary
// ============================================================

describe('getTeacherSummary — insufficient_data cases', () => {
  it('0 respuestas → insufficient_data', async () => {
    mockResponseAggregate.mockResolvedValue({ _count: { _all: 0 } });
    mockResponseFindMany.mockResolvedValue([]);
    mockDetailFindMany.mockResolvedValue([]);
    const r = await svc.getTeacherSummary('t1', T);
    expect(r.meta.insufficient_data).toBe(true);
    expect(r.meta.total_responses).toBe(0);
    expect(r.meta.minimum_required).toBe(MINIMUM_RESPONSES);
    expect(r.data).toBeNull();
  });

  it('1 respuesta → insufficient_data', async () => {
    mockResponseAggregate.mockResolvedValue({ _count: { _all: 1 } });
    mockResponseFindMany.mockResolvedValue([{ id: 'r1', teachingAssignmentId: 'as1' }]);
    mockDetailFindMany.mockResolvedValue([{ evaluationResponseId: 'r1', score: 4 }]);
    const r = await svc.getTeacherSummary('t1', T);
    expect(r.meta.insufficient_data).toBe(true);
    expect(r.meta.total_responses).toBe(1);
  });

  it('2 respuestas → insufficient_data', async () => {
    mockResponseAggregate.mockResolvedValue({ _count: { _all: 2 } });
    mockResponseFindMany.mockResolvedValue([
      { id: 'r1', teachingAssignmentId: 'as1' },
      { id: 'r2', teachingAssignmentId: 'as1' },
    ]);
    mockDetailFindMany.mockResolvedValue([
      { evaluationResponseId: 'r1', score: 4 },
      { evaluationResponseId: 'r2', score: 3 },
    ]);
    const r = await svc.getTeacherSummary('t1', T);
    expect(r.meta.insufficient_data).toBe(true);
    expect(r.meta.total_responses).toBe(2);
  });
});

describe('getTeacherSummary — datos suficientes', () => {
  it('3 respuestas → estadísticas disponibles', async () => {
    mockResponseAggregate.mockResolvedValue({ _count: { _all: 3 } });
    mockResponseFindMany.mockResolvedValue([
      { id: 'r1', teachingAssignmentId: 'as1' },
      { id: 'r2', teachingAssignmentId: 'as1' },
      { id: 'r3', teachingAssignmentId: 'as1' },
    ]);
    mockDetailFindMany.mockResolvedValue([
      { evaluationResponseId: 'r1', score: 5 },
      { evaluationResponseId: 'r1', score: 4 },
      { evaluationResponseId: 'r2', score: 3 },
      { evaluationResponseId: 'r2', score: 4 },
      { evaluationResponseId: 'r3', score: 4 },
      { evaluationResponseId: 'r3', score: 5 },
    ]);
    mockAssignmentFindMany.mockResolvedValue([
      { id: 'as1', courseId: 'c1', academicPeriodId: 'p1', cycle: 1, course: { id: 'c1', code: 'MAT', name: 'Mates' }, academicPeriod: { id: 'p1', name: '2026-I' } },
    ]);
    const r = await svc.getTeacherSummary('t1', T);
    expect(r.meta.insufficient_data).toBe(false);
    expect(r.data.totalResponses).toBe(3);
    expect(r.data.overallAverage).toBe(4.17);
    expect(r.data.byCourse).toHaveLength(1);
    expect(r.data.byCourse[0].averageScore).toBe(4.17);
  });

  it('promedio general correcto con múltiples assignments', async () => {
    mockResponseAggregate.mockResolvedValue({ _count: { _all: 6 } });
    mockResponseFindMany.mockResolvedValue([
      { id: 'r1', teachingAssignmentId: 'as1' },
      { id: 'r2', teachingAssignmentId: 'as1' },
      { id: 'r3', teachingAssignmentId: 'as1' },
      { id: 'r4', teachingAssignmentId: 'as2' },
      { id: 'r5', teachingAssignmentId: 'as2' },
      { id: 'r6', teachingAssignmentId: 'as2' },
    ]);
    mockDetailFindMany.mockResolvedValue([
      { evaluationResponseId: 'r1', score: 5 },
      { evaluationResponseId: 'r1', score: 5 },
      { evaluationResponseId: 'r2', score: 4 },
      { evaluationResponseId: 'r2', score: 4 },
      { evaluationResponseId: 'r3', score: 3 },
      { evaluationResponseId: 'r3', score: 3 },
      { evaluationResponseId: 'r4', score: 4 },
      { evaluationResponseId: 'r4', score: 4 },
      { evaluationResponseId: 'r5', score: 3 },
      { evaluationResponseId: 'r5', score: 3 },
      { evaluationResponseId: 'r6', score: 2 },
      { evaluationResponseId: 'r6', score: 2 },
    ]);
    mockAssignmentFindMany.mockResolvedValue([
      { id: 'as1', courseId: 'c1', academicPeriodId: 'p1', cycle: 1, course: { id: 'c1', code: 'M', name: 'Mates' }, academicPeriod: { id: 'p1', name: 'P1' } },
      { id: 'as2', courseId: 'c2', academicPeriodId: 'p1', cycle: 1, course: { id: 'c2', code: 'F', name: 'Fisica' }, academicPeriod: { id: 'p1', name: 'P1' } },
    ]);
    const r = await svc.getTeacherSummary('t1', T);
    expect(r.data.overallAverage).toBe(3.5);
    expect(r.data.byCourse).toHaveLength(2);
    expect(r.data.byCourse[0].averageScore).toBeGreaterThanOrEqual(r.data.byCourse[1].averageScore);
  });
});

describe('getTeacherSummary — seguridad', () => {
  it('TEACHER solo ve los suyos → FORBIDDEN', async () => {
    await expect(svc.getTeacherSummary('other', T)).rejects.toThrow('FORBIDDEN');
  });

  it('STUDENT no puede acceder → FORBIDDEN', async () => {
    await expect(svc.getTeacherSummary('t1', ST)).rejects.toThrow('FORBIDDEN');
  });

  it('ADMIN con otra organización → FORBIDDEN', async () => {
    mockFindUnique.mockResolvedValue({ id: 't2', role: 'TEACHER', organizationId: 'org2' });
    await expect(svc.getTeacherSummary('t2', A)).rejects.toThrow('FORBIDDEN');
  });

  it('where incluye status SUBMITTED', async () => {
    mockResponseAggregate.mockResolvedValue({ _count: { _all: 3 } });
    mockResponseFindMany.mockResolvedValue([]);
    mockDetailFindMany.mockResolvedValue([]);
    await svc.getTeacherSummary('t1', T);
    expect(mockResponseAggregate.mock.calls[0][0].where.status).toBe('SUBMITTED');
  });
});

// ============================================================
// getCriterionAverages
// ============================================================

describe('getCriterionAverages', () => {
  it('3 respuestas → promedios por criterio', async () => {
    mockResponseAggregate.mockResolvedValue({ _count: { _all: 3 } });
    mockDetailGroupBy.mockResolvedValue([
      { criterionId: 'c1', _avg: { score: 4.5 }, _count: { _all: 6 } },
      { criterionId: 'c2', _avg: { score: 3.0 }, _count: { _all: 6 } },
    ]);
    mockCriterionFindMany.mockResolvedValue([
      { id: 'c1', name: 'Claridad', description: null, isActive: true },
      { id: 'c2', name: 'Puntualidad', description: null, isActive: true },
    ]);
    const r = await svc.getCriterionAverages('t1', T);
    expect(r.meta.insufficient_data).toBe(false);
    expect(r.data.byCriterion[0].averageScore).toBe(4.5);
    expect(r.data.byCriterion[1].averageScore).toBe(3.0);
  });

  it('1 response con 3 details → insufficient_data', async () => {
    mockResponseAggregate.mockResolvedValue({ _count: { _all: 1 } });
    mockDetailGroupBy.mockResolvedValue([
      { criterionId: 'c1', _avg: { score: 5 }, _count: { _all: 1 } },
      { criterionId: 'c2', _avg: { score: 4 }, _count: { _all: 1 } },
      { criterionId: 'c3', _avg: { score: 3 }, _count: { _all: 1 } },
    ]);
    mockCriterionFindMany.mockResolvedValue([
      { id: 'c1', name: 'A', description: null, isActive: true },
      { id: 'c2', name: 'B', description: null, isActive: true },
      { id: 'c3', name: 'C', description: null, isActive: true },
    ]);
    const r = await svc.getCriterionAverages('t1', T);
    expect(r.meta.insufficient_data).toBe(true);
    expect(r.meta.total_responses).toBe(1);
  });

  it('criterio inactivo histórico aparece', async () => {
    mockResponseAggregate.mockResolvedValue({ _count: { _all: 4 } });
    mockDetailGroupBy.mockResolvedValue([
      { criterionId: 'ca', _avg: { score: 4.0 }, _count: { _all: 4 } },
      { criterionId: 'ci', _avg: { score: 3.5 }, _count: { _all: 4 } },
    ]);
    mockCriterionFindMany.mockResolvedValue([
      { id: 'ca', name: 'A', description: null, isActive: true },
      { id: 'ci', name: 'B', description: null, isActive: false },
    ]);
    const r = await svc.getCriterionAverages('t1', T);
    const inactive = r.data.byCriterion.find((c) => c.criterionId === 'ci');
    expect(inactive.isActive).toBe(false);
    expect(inactive.averageScore).toBe(3.5);
  });
});

// ============================================================
// getScoreDistribution
// ============================================================

describe('getScoreDistribution', () => {
  it('retorna 5 categorías', async () => {
    mockResponseAggregate.mockResolvedValue({ _count: { _all: 10 } });
    mockDetailGroupBy.mockResolvedValue([
      { score: 5, _count: { _all: 4 } },
      { score: 4, _count: { _all: 3 } },
      { score: 3, _count: { _all: 2 } },
      { score: 2, _count: { _all: 1 } },
    ]);
    const r = await svc.getScoreDistribution('t1', T);
    expect(r.data.distribution).toHaveLength(5);
    expect(r.data.distribution[0]).toEqual({ score: 5, count: 4 });
    expect(r.data.distribution[4]).toEqual({ score: 1, count: 0 });
  });
});

// ============================================================
// getAnonymousComments
// ============================================================

describe('getAnonymousComments', () => {
  it('sin datos identificables', async () => {
    mockResponseAggregate.mockResolvedValue({ _count: { _all: 5 } });
    mockResponseFindMany.mockResolvedValue([
      { comment: 'Bueno' },
      { comment: 'Malo' },
      { comment: 'Regular' },
      { comment: 'A' },
      { comment: 'B' },
    ]);
    const r = await svc.getAnonymousComments('t1', T);
    expect(r.data.comments).toHaveLength(5);
    expect(JSON.stringify(r)).not.toContain('studentId');
    expect(JSON.stringify(r)).not.toContain('firstName');
    expect(JSON.stringify(r)).not.toContain('email');
  });

  it('solo strings en comentarios', async () => {
    mockResponseAggregate.mockResolvedValue({ _count: { _all: 3 } });
    mockResponseFindMany.mockResolvedValue([{ comment: 'A' }, { comment: 'B' }, { comment: 'C' }]);
    const r = await svc.getAnonymousComments('t1', T);
    for (const c of r.data.comments) expect(typeof c).toBe('string');
    expect(r.data).not.toHaveProperty('students');
  });
});

// ============================================================
// getScoreEvolution
// ============================================================

describe('getScoreEvolution', () => {
  it('agrupa por periodo', async () => {
    mockResponseAggregate.mockResolvedValue({ _count: { _all: 6 } });
    mockResponseFindMany.mockResolvedValue([
      { id: 'r1', teachingAssignmentId: 'a1' },
      { id: 'r2', teachingAssignmentId: 'a1' },
      { id: 'r3', teachingAssignmentId: 'a1' },
      { id: 'r4', teachingAssignmentId: 'a2' },
      { id: 'r5', teachingAssignmentId: 'a2' },
      { id: 'r6', teachingAssignmentId: 'a2' },
    ]);
    mockDetailFindMany.mockResolvedValue([
      { evaluationResponseId: 'r1', score: 4 },
      { evaluationResponseId: 'r1', score: 3 },
      { evaluationResponseId: 'r2', score: 3 },
      { evaluationResponseId: 'r2', score: 4 },
      { evaluationResponseId: 'r3', score: 4 },
      { evaluationResponseId: 'r3', score: 3 },
      { evaluationResponseId: 'r4', score: 5 },
      { evaluationResponseId: 'r4', score: 4 },
      { evaluationResponseId: 'r5', score: 5 },
      { evaluationResponseId: 'r5', score: 5 },
      { evaluationResponseId: 'r6', score: 4 },
      { evaluationResponseId: 'r6', score: 5 },
    ]);
    mockAssignmentFindMany.mockResolvedValue([
      { id: 'a1', academicPeriodId: 'p1', academicPeriod: { id: 'p1', name: '2025-II', startDate: '2025-08-01' } },
      { id: 'a2', academicPeriodId: 'p2', academicPeriod: { id: 'p2', name: '2026-I', startDate: '2026-02-01' } },
    ]);
    const r = await svc.getScoreEvolution('t1', T);
    expect(r.data.evolution).toHaveLength(2);
    expect(r.data.evolution[0].academicPeriod.name).toBe('2025-II');
    expect(r.data.evolution[0].averageScore).toBe(3.5);
    expect(r.data.evolution[1].averageScore).toBe(4.67);
    expect(r.data.evolution[0].totalResponses).toBe(3);
    expect(r.data.evolution[1].totalResponses).toBe(3);
  });

  it('insufficient_data con < 3 respuestas totales', async () => {
    mockResponseAggregate.mockResolvedValue({ _count: { _all: 2 } });
    mockResponseFindMany.mockResolvedValue([]);
    mockDetailFindMany.mockResolvedValue([]);
    const r = await svc.getScoreEvolution('t1', T);
    expect(r.meta.insufficient_data).toBe(true);
    expect(r.meta.total_responses).toBe(2);
  });
});

// ============================================================
// Per-course: multiple details NO cuentan como evaluadores
// ============================================================

describe('multiples details NO cuentan como evaluadores', () => {
  it('cuenta 1 response con 3 details, no 3 evaluadores', async () => {
    mockResponseAggregate.mockResolvedValue({ _count: { _all: 1 } });
    mockResponseFindMany.mockResolvedValue([
      { id: 'r1', teachingAssignmentId: 'as1' },
    ]);
    mockDetailFindMany.mockResolvedValue([
      { evaluationResponseId: 'r1', score: 5 },
      { evaluationResponseId: 'r1', score: 4 },
      { evaluationResponseId: 'r1', score: 3 },
    ]);
    mockAssignmentFindMany.mockResolvedValue([
      { id: 'as1', courseId: 'c1', academicPeriodId: 'p1', cycle: 1, course: { id: 'c1', code: 'M', name: 'M' }, academicPeriod: { id: 'p1', name: 'P1' } },
    ]);
    const r = await svc.getTeacherSummary('t1', T);
    expect(r.meta.insufficient_data).toBe(true);
    expect(r.meta.total_responses).toBe(1);
  });
});

// ============================================================
// BUG 1 fix: 3 evaluadores × 4 criterios
// ============================================================

describe('BUG1 fix — 3 evaluadores × 4 criterios', () => {
  it('overallAverage = 3.92, totalResponses = 3, byCourse.totalResponses = 3', async () => {
    mockResponseAggregate.mockResolvedValue({ _count: { _all: 3 } });
    mockResponseFindMany.mockResolvedValue([
      { id: 'r1', teachingAssignmentId: 'as1' },
      { id: 'r2', teachingAssignmentId: 'as1' },
      { id: 'r3', teachingAssignmentId: 'as1' },
    ]);
    mockDetailFindMany.mockResolvedValue([
      { evaluationResponseId: 'r1', score: 5 },
      { evaluationResponseId: 'r1', score: 4 },
      { evaluationResponseId: 'r1', score: 3 },
      { evaluationResponseId: 'r1', score: 4 },
      { evaluationResponseId: 'r2', score: 4 },
      { evaluationResponseId: 'r2', score: 3 },
      { evaluationResponseId: 'r2', score: 4 },
      { evaluationResponseId: 'r2', score: 5 },
      { evaluationResponseId: 'r3', score: 3 },
      { evaluationResponseId: 'r3', score: 5 },
      { evaluationResponseId: 'r3', score: 4 },
      { evaluationResponseId: 'r3', score: 3 },
    ]);
    mockAssignmentFindMany.mockResolvedValue([
      { id: 'as1', courseId: 'c1', academicPeriodId: 'p1', cycle: 1, course: { id: 'c1', code: 'MAT', name: 'Mates' }, academicPeriod: { id: 'p1', name: '2026-I' } },
    ]);
    const r = await svc.getTeacherSummary('t1', T);
    expect(r.meta.insufficient_data).toBe(false);
    expect(r.data.totalResponses).toBe(3);
    expect(r.data.overallAverage).toBe(3.92);
    expect(r.data.byCourse).toHaveLength(1);
    expect(r.data.byCourse[0].averageScore).toBe(3.92);
    expect(r.data.byCourse[0].totalResponses).toBe(3);
  });
});

// ============================================================
// BUG 1 fix: responseCount != detailCount explícito
// ============================================================

describe('BUG1 fix — responseCount ≠ detailCount', () => {
  it('3 responses con 4 details cada una → responseCount=3, detailCount=12', async () => {
    mockResponseAggregate.mockResolvedValue({ _count: { _all: 3 } });
    mockResponseFindMany.mockResolvedValue([
      { id: 'r1', teachingAssignmentId: 'as1' },
      { id: 'r2', teachingAssignmentId: 'as1' },
      { id: 'r3', teachingAssignmentId: 'as1' },
    ]);
    const twelveDetails = [
      { evaluationResponseId: 'r1', score: 5 },
      { evaluationResponseId: 'r1', score: 4 },
      { evaluationResponseId: 'r1', score: 3 },
      { evaluationResponseId: 'r1', score: 4 },
      { evaluationResponseId: 'r2', score: 4 },
      { evaluationResponseId: 'r2', score: 3 },
      { evaluationResponseId: 'r2', score: 4 },
      { evaluationResponseId: 'r2', score: 5 },
      { evaluationResponseId: 'r3', score: 3 },
      { evaluationResponseId: 'r3', score: 5 },
      { evaluationResponseId: 'r3', score: 4 },
      { evaluationResponseId: 'r3', score: 3 },
    ];
    mockDetailFindMany.mockResolvedValue(twelveDetails);
    mockAssignmentFindMany.mockResolvedValue([
      { id: 'as1', courseId: 'c1', academicPeriodId: 'p1', cycle: 1, course: { id: 'c1', code: 'MAT', name: 'Mates' }, academicPeriod: { id: 'p1', name: '2026-I' } },
    ]);
    const r = await svc.getTeacherSummary('t1', T);
    expect(twelveDetails.length).toBe(12);
    expect(r.data.totalResponses).toBe(3);
    expect(r.data.totalResponses).not.toBe(twelveDetails.length);
    expect(r.data.byCourse[0].totalResponses).toBe(3);
    expect(r.data.byCourse[0].totalResponses).not.toBe(twelveDetails.length);
  });
});

// ============================================================
// BUG 2 fix: evolución con periodos mixtos
// ============================================================

describe('BUG2 fix — evolución con periodos mixtos', () => {
  it('periodo A=3 responses, periodo B=2 responses → solo A aparece', async () => {
    mockResponseAggregate.mockResolvedValue({ _count: { _all: 5 } });
    mockResponseFindMany.mockResolvedValue([
      { id: 'r1', teachingAssignmentId: 'a1' },
      { id: 'r2', teachingAssignmentId: 'a1' },
      { id: 'r3', teachingAssignmentId: 'a1' },
      { id: 'r4', teachingAssignmentId: 'a2' },
      { id: 'r5', teachingAssignmentId: 'a2' },
    ]);
    mockDetailFindMany.mockResolvedValue([
      { evaluationResponseId: 'r1', score: 4 },
      { evaluationResponseId: 'r1', score: 4 },
      { evaluationResponseId: 'r1', score: 4 },
      { evaluationResponseId: 'r1', score: 4 },
      { evaluationResponseId: 'r2', score: 3 },
      { evaluationResponseId: 'r2', score: 3 },
      { evaluationResponseId: 'r2', score: 3 },
      { evaluationResponseId: 'r2', score: 3 },
      { evaluationResponseId: 'r3', score: 5 },
      { evaluationResponseId: 'r3', score: 5 },
      { evaluationResponseId: 'r3', score: 5 },
      { evaluationResponseId: 'r3', score: 5 },
      { evaluationResponseId: 'r4', score: 4 },
      { evaluationResponseId: 'r4', score: 4 },
      { evaluationResponseId: 'r4', score: 4 },
      { evaluationResponseId: 'r4', score: 4 },
      { evaluationResponseId: 'r5', score: 2 },
      { evaluationResponseId: 'r5', score: 2 },
      { evaluationResponseId: 'r5', score: 2 },
      { evaluationResponseId: 'r5', score: 2 },
    ]);
    mockAssignmentFindMany.mockResolvedValue([
      { id: 'a1', academicPeriodId: 'p1', academicPeriod: { id: 'p1', name: '2025-II', startDate: '2025-08-01' } },
      { id: 'a2', academicPeriodId: 'p2', academicPeriod: { id: 'p2', name: '2026-I', startDate: '2026-02-01' } },
    ]);
    const r = await svc.getScoreEvolution('t1', T);
    expect(r.data.evolution).toHaveLength(1);
    expect(r.data.evolution[0].academicPeriod.name).toBe('2025-II');
    expect(r.data.evolution[0].totalResponses).toBe(3);
    expect(r.data.evolution[0].averageScore).toBe(4);
  });
});

// ============================================================
// BUG 2 fix: mínimo por periodo
// ============================================================

describe('BUG2 fix — mínimo 3 por periodo', () => {
  it('5 responses totales pero periodo B solo 2 → B excluido', async () => {
    mockResponseAggregate.mockResolvedValue({ _count: { _all: 5 } });
    mockResponseFindMany.mockResolvedValue([
      { id: 'r1', teachingAssignmentId: 'a1' },
      { id: 'r2', teachingAssignmentId: 'a1' },
      { id: 'r3', teachingAssignmentId: 'a1' },
      { id: 'r4', teachingAssignmentId: 'a2' },
      { id: 'r5', teachingAssignmentId: 'a2' },
    ]);
    mockDetailFindMany.mockResolvedValue([
      { evaluationResponseId: 'r1', score: 4 },
      { evaluationResponseId: 'r1', score: 4 },
      { evaluationResponseId: 'r1', score: 4 },
      { evaluationResponseId: 'r2', score: 3 },
      { evaluationResponseId: 'r2', score: 3 },
      { evaluationResponseId: 'r2', score: 3 },
      { evaluationResponseId: 'r3', score: 5 },
      { evaluationResponseId: 'r3', score: 5 },
      { evaluationResponseId: 'r3', score: 5 },
      { evaluationResponseId: 'r4', score: 4 },
      { evaluationResponseId: 'r4', score: 4 },
      { evaluationResponseId: 'r4', score: 4 },
      { evaluationResponseId: 'r5', score: 2 },
      { evaluationResponseId: 'r5', score: 2 },
      { evaluationResponseId: 'r5', score: 2 },
    ]);
    mockAssignmentFindMany.mockResolvedValue([
      { id: 'a1', academicPeriodId: 'p1', academicPeriod: { id: 'p1', name: '2025-II', startDate: '2025-08-01' } },
      { id: 'a2', academicPeriodId: 'p2', academicPeriod: { id: 'p2', name: '2026-I', startDate: '2026-02-01' } },
    ]);
    const r = await svc.getScoreEvolution('t1', T);
    const p1 = r.data.evolution.find((e) => e.academicPeriod.name === '2025-II');
    const p2 = r.data.evolution.find((e) => e.academicPeriod.name === '2026-I');
    expect(p1).toBeDefined();
    expect(p1.totalResponses).toBe(3);
    expect(p1.averageScore).toBe(4);
    expect(p2).toBeUndefined();
  });
});
