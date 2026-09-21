// tests/unit/teachingEvaluation/evaluationResults.test.js
import { jest } from '@jest/globals';

const mockAggregate = jest.fn();
const mockGroupBy = jest.fn();
const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();

jest.unstable_mockModule('../../../src/database/prisma.js', () => ({
  prisma: {
    evaluationResponse: { aggregate: mockAggregate, groupBy: mockGroupBy, findMany: mockFindMany },
    evaluationResponseDetail: { groupBy: mockGroupBy },
    evaluationCriterion: { findMany: mockFindMany },
    teachingAssignment: { findMany: mockFindMany },
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

beforeEach(() => { jest.clearAllMocks(); mockFindUnique.mockResolvedValue(teacherRec); });

describe('1. 0 respuestas -> insufficient_data', () => {
  it('devuelve insufficient_data', async () => {
    mockAggregate.mockResolvedValue({ _avg: { _all: null }, _count: { _all: 0 } });
    mockGroupBy.mockResolvedValue([]);
    const r = await svc.getTeacherSummary('t1', T);
    expect(r.meta.insufficient_data).toBe(true);
    expect(r.meta.total_responses).toBe(0);
    expect(r.meta.minimum_required).toBe(MINIMUM_RESPONSES);
    expect(r.data).toBeNull();
  });
});

describe('2. 1 respuesta -> insufficient_data', () => {
  it('devuelve insufficient_data', async () => {
    mockAggregate.mockResolvedValue({ _avg: { _all: 4.0 }, _count: { _all: 1 } });
    mockGroupBy.mockResolvedValue([]);
    const r = await svc.getTeacherSummary('t1', T);
    expect(r.meta.insufficient_data).toBe(true);
    expect(r.meta.total_responses).toBe(1);
  });
});

describe('3. 2 respuestas -> insufficient_data', () => {
  it('devuelve insufficient_data', async () => {
    mockAggregate.mockResolvedValue({ _avg: { _all: 3.5 }, _count: { _all: 2 } });
    mockGroupBy.mockResolvedValue([]);
    const r = await svc.getTeacherSummary('t1', T);
    expect(r.meta.insufficient_data).toBe(true);
    expect(r.meta.total_responses).toBe(2);
  });
});

describe('4. 3 respuestas -> estadisticas disponibles', () => {
  it('devuelve datos con 3 respuestas', async () => {
    mockAggregate.mockResolvedValue({ _avg: { _all: 4.0 }, _count: { _all: 3 } });
    mockGroupBy.mockResolvedValue([{ teachingAssignmentId: 'as1', _avg: { _all: 4.0 }, _count: { _all: 3 } }]);
    mockFindMany.mockResolvedValue([{ id: 'as1', courseId: 'c1', academicPeriodId: 'p1', cycle: 1, course: { id: 'c1', code: 'MAT', name: 'Mates' }, academicPeriod: { id: 'p1', name: '2026-I' } }]);
    const r = await svc.getTeacherSummary('t1', T);
    expect(r.meta.insufficient_data).toBe(false);
    expect(r.data.overallAverage).toBe(4.0);
    expect(r.data.totalResponses).toBe(3);
    expect(r.data.byCourse).toHaveLength(1);
  });
});

describe('5. Multiples details NO cuentan como evaluadores', () => {
  it('cuenta 1 response, no 3 details', async () => {
    mockAggregate.mockResolvedValue({ _count: { _all: 1 } });
    mockGroupBy.mockResolvedValue([
      { criterionId: 'c1', _avg: { score: 5 }, _count: { _all: 1 } },
      { criterionId: 'c2', _avg: { score: 4 }, _count: { _all: 1 } },
      { criterionId: 'c3', _avg: { score: 3 }, _count: { _all: 1 } },
    ]);
    mockFindMany.mockResolvedValue([
      { id: 'c1', name: 'A', description: null, isActive: true },
      { id: 'c2', name: 'B', description: null, isActive: true },
      { id: 'c3', name: 'C', description: null, isActive: true },
    ]);
    const r = await svc.getCriterionAverages('t1', T);
    expect(r.meta.insufficient_data).toBe(true);
    expect(r.meta.total_responses).toBe(1);
  });
});

describe('6. Promedio general correcto', () => {
  it('calcula promedio correctamente', async () => {
    mockAggregate.mockResolvedValue({ _avg: { _all: 3.67 }, _count: { _all: 6 } });
    mockGroupBy.mockResolvedValue([
      { teachingAssignmentId: 'a1', _avg: { _all: 4.0 }, _count: { _all: 3 } },
      { teachingAssignmentId: 'a2', _avg: { _all: 3.33 }, _count: { _all: 3 } },
    ]);
    mockFindMany.mockResolvedValue([
      { id: 'a1', courseId: 'c1', academicPeriodId: 'p1', cycle: 1, course: { id: 'c1', code: 'M', name: 'M' }, academicPeriod: { id: 'p1', name: 'P1' } },
      { id: 'a2', courseId: 'c2', academicPeriodId: 'p1', cycle: 1, course: { id: 'c2', code: 'F', name: 'F' }, academicPeriod: { id: 'p1', name: 'P1' } },
    ]);
    const r = await svc.getTeacherSummary('t1', T);
    expect(r.data.overallAverage).toBe(3.67);
    expect(r.data.byCourse[0].averageScore).toBeGreaterThanOrEqual(r.data.byCourse[1].averageScore);
  });
});

describe('7. Promedio por criterio correcto', () => {
  it('calcula promedio por criterio', async () => {
    mockAggregate.mockResolvedValue({ _count: { _all: 3 } });
    mockGroupBy.mockResolvedValue([
      { criterionId: 'c1', _avg: { score: 4.5 }, _count: { _all: 6 } },
      { criterionId: 'c2', _avg: { score: 3.0 }, _count: { _all: 6 } },
    ]);
    mockFindMany.mockResolvedValue([
      { id: 'c1', name: 'Claridad', description: null, isActive: true },
      { id: 'c2', name: 'Puntualidad', description: null, isActive: true },
    ]);
    const r = await svc.getCriterionAverages('t1', T);
    expect(r.meta.insufficient_data).toBe(false);
    expect(r.data.byCriterion[0].averageScore).toBe(4.5);
    expect(r.data.byCriterion[1].averageScore).toBe(3.0);
  });
});

describe('8. TEACHER solo ve los suyos', () => {
  it('lanza error con otro teacher', async () => {
    await expect(svc.getTeacherSummary('other', T)).rejects.toThrow('FORBIDDEN');
  });
});

describe('9. TEACHER no recibe studentId', () => {
  it('sin studentId en respuesta', async () => {
    mockAggregate.mockResolvedValue({ _count: { _all: 3 } });
    mockFindMany.mockResolvedValue([{ comment: 'Bueno' }, { comment: 'Malo' }, { comment: 'Regular' }]);
    const r = await svc.getAnonymousComments('t1', T);
    expect(r.data.comments).toHaveLength(3);
    expect(JSON.stringify(r)).not.toContain('studentId');
    expect(JSON.stringify(r)).not.toContain('firstName');
    expect(JSON.stringify(r)).not.toContain('email');
  });
});

describe('10. Sin datos identificables en comentarios', () => {
  it('solo strings', async () => {
    mockAggregate.mockResolvedValue({ _count: { _all: 5 } });
    mockFindMany.mockResolvedValue([{ comment: 'A' }, { comment: 'B' }, { comment: 'C' }, { comment: 'D' }, { comment: 'E' }]);
    const r = await svc.getAnonymousComments('t1', T);
    for (const c of r.data.comments) expect(typeof c).toBe('string');
    expect(r.data).not.toHaveProperty('students');
  });
});

describe('11. ADMIN tenant isolation', () => {
  it('error con otra organizacion', async () => {
    mockFindUnique.mockResolvedValue({ id: 't2', role: 'TEACHER', organizationId: 'org2' });
    await expect(svc.getTeacherSummary('t2', A)).rejects.toThrow('FORBIDDEN');
  });
});

describe('12. DRAFT no participa', () => {
  it('where incluye status SUBMITTED', async () => {
    mockAggregate.mockResolvedValue({ _avg: { _all: 4.0 }, _count: { _all: 3 } });
    mockGroupBy.mockResolvedValue([]);
    await svc.getTeacherSummary('t1', T);
    expect(mockAggregate.mock.calls[0][0].where.status).toBe('SUBMITTED');
  });
});

describe('13. SUBMITTED si participa', () => {
  it('cuenta respuestas SUBMITTED', async () => {
    mockAggregate.mockResolvedValue({ _avg: { _all: 4.0 }, _count: { _all: 5 } });
    mockGroupBy.mockResolvedValue([]);
    const r = await svc.getTeacherSummary('t1', T);
    expect(r.meta.total_responses).toBe(5);
  });
});

describe('14. Criterio inactivo historico aparece', () => {
  it('incluye criterios inactivos con respuestas', async () => {
    mockAggregate.mockResolvedValue({ _count: { _all: 4 } });
    mockGroupBy.mockResolvedValue([
      { criterionId: 'ca', _avg: { score: 4.0 }, _count: { _all: 4 } },
      { criterionId: 'ci', _avg: { score: 3.5 }, _count: { _all: 4 } },
    ]);
    mockFindMany.mockResolvedValue([
      { id: 'ca', name: 'A', description: null, isActive: true },
      { id: 'ci', name: 'B', description: null, isActive: false },
    ]);
    const r = await svc.getCriterionAverages('t1', T);
    const inactive = r.data.byCriterion.find((c) => c.criterionId === 'ci');
    expect(inactive.isActive).toBe(false);
    expect(inactive.averageScore).toBe(3.5);
  });
});

describe('15. STUDENT no puede acceder', () => {
  it('lanza error', async () => {
    await expect(svc.getTeacherSummary('t1', ST)).rejects.toThrow('FORBIDDEN');
  });
});

describe('BONUS: Distribucion de scores', () => {
  it('retorna 5 categorias', async () => {
    mockAggregate.mockResolvedValue({ _count: { _all: 10 } });
    mockGroupBy.mockResolvedValue([
      { score: 5, _count: { _all: 4 } },
      { score: 4, _count: { _all: 3 } },
      { score: 3, _count: { _all: 2 } },
      { score: 2, _count: { _all: 1 } },
    ]);
    const r = await svc.getScoreDistribution('t1', T);
    expect(r.data.distribution).toHaveLength(5);
    expect(r.data.distribution[0]).toEqual({ score: 5, count: 4 });
  });
});

describe('BONUS: Evolucion por periodo', () => {
  it('agrupa por periodo', async () => {
    mockAggregate.mockResolvedValue({ _count: { _all: 6 } });
    mockGroupBy.mockResolvedValue([
      { teachingAssignmentId: 'a1', _avg: { _all: 3.5 }, _count: { _all: 3 } },
      { teachingAssignmentId: 'a2', _avg: { _all: 4.5 }, _count: { _all: 3 } },
    ]);
    mockFindMany.mockResolvedValue([
      { id: 'a1', academicPeriodId: 'p1', academicPeriod: { id: 'p1', name: '2025-II', startDate: '2025-08-01' } },
      { id: 'a2', academicPeriodId: 'p2', academicPeriod: { id: 'p2', name: '2026-I', startDate: '2026-02-01' } },
    ]);
    const r = await svc.getScoreEvolution('t1', T);
    expect(r.data.evolution).toHaveLength(2);
    expect(r.data.evolution[0].academicPeriod.name).toBe('2025-II');
  });
});
