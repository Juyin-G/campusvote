/**
 * FairResults — pruebas de integración HTTP + BD real (PostgreSQL).
 *
 * IMPORTANTE: este archivo requiere PostgreSQL real (jest + tests/setup-db.js).
 * Ejecutar solo en el entorno señalado: `npm run test:integration`.
 * La lógica pura de ranking/promedio/winner se cubre de forma aislada (sin BD)
 * en tests/unit/fairResults/fairResult.ranking.test.js (`node --test`).
 *
 * Cubre las 30 reglas del PASO 7:
 *   Publicación oficial (1-20): endpoint POST /api/fairs/:id/results/publish
 *   (409 si no CLOSED o ya publicada; 403 tenant/roles; 404 inexistente; body
 *   del cliente ignorado; winner solo después de publicar; published/gatado en
 *   GET results sin alterar el ranking).
 *   Revisión de proyectos por JURY (21-30): GET /api/fairs/:id/projects/:projectId
 *   para el JURY asignado y el ADMIN/SUPERADMIN de resultados (403 STUDENT, 403 sin asignación,
 *   404 si el proyecto es de otra feria o no está APPROVED, sin datos sensibles).
 */
import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import request from 'supertest';

jest.unstable_mockModule('../../src/middlewares/rateLimiter.middleware.js', () => ({
  loginLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  userLimiter: () => (_req, _res, next) => next(),
  userElectionLimiter: () => (_req, _res, next) => next(),
}));

const app = (await import('../../src/app.js')).default;
const { prisma } = await import('../../src/database/prisma.js');

const PASSWORD = 'FairResultsTest123!';
const runId = Date.now();

// ids fijos para los desempates deterministas (uuid v4 válidos).
const P1 = '10000000-0000-4000-8000-000000000001'; // APP, 3 evals (18,19,17) → 18.00
const P4 = '10000000-0000-4000-8000-000000000002'; // APP, 3 evals (18,18,18) → 18.00
const P5 = '10000000-0000-4000-8000-000000000003'; // APP, 2 evals (18,18)   → 18.00
const P2 = '10000000-0000-4000-8000-000000000004'; // APP, 2 evals (19,19)   → 19.00 (gana al publicar)
const P3 = '10000000-0000-4000-8000-000000000005'; // APP, sin evaluaciones
const OPEN_P1 = '20000000-0000-4000-8000-000000000001';
const OPEN_P2 = '20000000-0000-4000-8000-000000000002';
const FOREIGN_P1 = '30000000-0000-4000-8000-000000000001';
const CLOSED2_P1 = '50000000-0000-4000-8000-000000000001'; // feria CLOSED2 (publicación)

const JURY_A = '40000000-0000-4000-8000-000000000001';
const JURY_C = '40000000-0000-4000-8000-000000000003';

let fairClosedId;    // CLOSED, NUNCA publicada (rankings + revisión JURY)
let fairOpenId;      // OPEN (publicar → 409)
let fairForeignId;   // CLOSED en orgB
let fairClosed2Id;   // CLOSED para el flujo de publicación

let draftProjectId;
let submittedProjectId;
let rejectedProjectId;

let adminAId;
let adminAToken;
let adminBToken;
let superToken;
let studentToken;
let teacherToken;
let electoralCommissionToken;
let juryToken;
let juryCToken;

let closed2RankingBefore;

// Docente con facultad, como en una universidad (la facultad es opcional).
let facultyId;

const login = async (email) => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password: PASSWORD });
  return res.body.data.token;
};

const createUser = async ({ role, organizationId, suffix, id } = {}) => {
  const base = {
    username: `fr.${role.toLowerCase()}.${suffix}.${runId}`,
    email: `fr.${role.toLowerCase()}.${suffix}.${runId}@campusvote.edu.pe`,
    password: await bcrypt.hash(PASSWORD, 12),
    firstName: 'Fair',
    lastName: role,
    institutionalId: `FR${suffix}${runId}`,
    role,
    authProvider: 'LOCAL',
    isVerified: true,
    status: 'ACTIVE',
    mustChangePassword: false,
    organizationId,
    facultyId: role === 'TEACHER' ? facultyId : null,
  };
  const created = await prisma.user.create({ data: id ? { ...base, id } : base });
  return created;
};

const createProject = async ({ id, fairId, organizationId, createdById, name, status }) =>
  prisma.project.create({
    data: {
      id, fairId, organizationId, createdById, name, status, description: null,
      // chk_projects_review_consistency: aprobado/rechazado exige fecha de revisión.
      reviewedAt: ['APPROVED', 'REJECTED'].includes(status) ? new Date() : null,
    },
  });

const createEvaluation = async ({ fairId, projectId, juryUserId, rubricId, totalScore }) =>
  prisma.fairEvaluation.create({
    data: { fairId, projectId, juryUserId, rubricId, totalScore, comment: null },
  });

const publishResults = (token, fairId, body) =>
  request(app)
    .post(`/api/fairs/${fairId}/results/publish`)
    .set('Authorization', `Bearer ${token}`)
    .send(body ?? {});

const getProjectReview = (token, fairId, projectId) =>
  request(app)
    .get(`/api/fairs/${fairId}/projects/${projectId}`)
    .set('Authorization', `Bearer ${token}`);

describe('FairResults Integration (HTTP + DB)', () => {
  beforeAll(async () => {
    const faculty = await prisma.faculty.create({
      data: { name: `Facultad Ferias ${runId}`, code: `FR${runId}`.slice(0, 20) },
    });
    facultyId = faculty.id;

    const orgA = await prisma.organization.create({
      data: { name: `Org A ${runId}`, code: `ORGA${runId}` },
    });
    const orgB = await prisma.organization.create({
      data: { name: `Org B ${runId}`, code: `ORGB${runId}` },
    });

    const adminA = await createUser({ role: 'ADMIN', organizationId: orgA.id, suffix: 'AdmA' });
    const adminB = await createUser({ role: 'ADMIN', organizationId: orgB.id, suffix: 'AdmB' });
    const superAdmin = await createUser({ role: 'SUPERADMIN', organizationId: null, suffix: 'Sup' });
    const student = await createUser({ role: 'STUDENT', organizationId: orgA.id, suffix: 'Std' });
    const teacher = await createUser({ role: 'TEACHER', organizationId: orgA.id, suffix: 'Tch' });
    const ec = await createUser({ role: 'ELECTORAL_COMMISSION', organizationId: orgA.id, suffix: 'Ec' });
    const juryA = await createUser({ role: 'JURY', organizationId: orgA.id, suffix: 'JuryA', id: JURY_A });
    const juryC = await createUser({ role: 'JURY', organizationId: orgA.id, suffix: 'JuryC', id: JURY_C });
    // Un jurado evalúa una sola vez cada proyecto (uq_fair_evaluations_fair_project_jury):
    // para varias evaluaciones del mismo proyecto hacen falta varios jurados.
    const juryE2 = await createUser({ role: 'JURY', organizationId: orgA.id, suffix: 'JuryE2' });
    const juryE3 = await createUser({ role: 'JURY', organizationId: orgA.id, suffix: 'JuryE3' });
    const evaluadores = [JURY_A, juryE2.id, juryE3.id];
    const asignarEvaluadores = (fairId) =>
      Promise.all(
        evaluadores.map((userId) =>
          prisma.fairJuryAssignment.create({ data: { fairId, userId, assignedById: adminA.id } })
        )
      );
    const evaluar = async ({ fairId, projectId, rubricId, scores }) => {
      for (const [i, totalScore] of scores.entries()) {
        await createEvaluation({ fairId, projectId, juryUserId: evaluadores[i], rubricId, totalScore });
      }
    };

    adminAId = adminA.id;

    // ── Feria CLOSED sin publicar (orgA): rankings + revisión JURY ──
    fairClosedId = (
      await prisma.fair.create({
        data: { organizationId: orgA.id, name: `Feria Cerrada ${runId}`, status: 'OPEN' },
      })
    ).id;

    const rubricClosed = await prisma.fairRubric.create({
      data: { fairId: fairClosedId, name: 'Rúbrica' },
    });

    await asignarEvaluadores(fairClosedId);

    await createProject({
      id: P1, fairId: fairClosedId, organizationId: orgA.id, createdById: student.id, name: 'Alpha', status: 'APPROVED',
    });
    await createProject({
      id: P4, fairId: fairClosedId, organizationId: orgA.id, createdById: student.id, name: 'Delta', status: 'APPROVED',
    });
    await createProject({
      id: P5, fairId: fairClosedId, organizationId: orgA.id, createdById: student.id, name: 'Echo', status: 'APPROVED',
    });
    await createProject({
      id: P2, fairId: fairClosedId, organizationId: orgA.id, createdById: student.id, name: 'Bravo', status: 'APPROVED',
    });
    await createProject({
      id: P3, fairId: fairClosedId, organizationId: orgA.id, createdById: student.id, name: 'SinEval', status: 'APPROVED',
    });
    const draftProj = await createProject({
      fairId: fairClosedId, organizationId: orgA.id, createdById: student.id, name: 'DraftProj', status: 'DRAFT',
    });
    const submittedProj = await createProject({
      fairId: fairClosedId, organizationId: orgA.id, createdById: student.id, name: 'Submitted', status: 'SUBMITTED',
    });
    const rejectedProj = await createProject({
      fairId: fairClosedId, organizationId: orgA.id, createdById: student.id, name: 'Rejected', status: 'REJECTED',
    });
    draftProjectId = draftProj.id;
    submittedProjectId = submittedProj.id;
    rejectedProjectId = rejectedProj.id;

    // Un integrante en P2 para el detalle de revisión del JURY.
    await prisma.projectMember.create({
      data: { projectId: P2, userId: student.id, role: 'EXPOSITOR' },
    });

    // Evaluaciones Mientras la feria está OPEN (trigger de 004 lo exige).
    await evaluar({ fairId: fairClosedId, projectId: P1, rubricId: rubricClosed.id, scores: [18, 19, 17] });
    await evaluar({ fairId: fairClosedId, projectId: P4, rubricId: rubricClosed.id, scores: [18, 18, 18] });
    await evaluar({ fairId: fairClosedId, projectId: P5, rubricId: rubricClosed.id, scores: [18, 18] });
    await evaluar({ fairId: fairClosedId, projectId: P2, rubricId: rubricClosed.id, scores: [19, 19] });

    await prisma.fair.update({ where: { id: fairClosedId }, data: { status: 'CLOSED' } });

    // ── Feria OPEN (orgA): sin ganador definitivo ──────────────────
    fairOpenId = (
      await prisma.fair.create({
        data: { organizationId: orgA.id, name: `Feria Abierta ${runId}`, status: 'OPEN' },
      })
    ).id;

    const rubricOpen = await prisma.fairRubric.create({
      data: { fairId: fairOpenId, name: 'Rúbrica' },
    });
    await prisma.fairJuryAssignment.create({
      data: { fairId: fairOpenId, userId: JURY_A, assignedById: adminA.id },
    });
    await createProject({
      id: OPEN_P1, fairId: fairOpenId, organizationId: orgA.id, createdById: student.id, name: 'OpenEval', status: 'APPROVED',
    });
    await createProject({
      id: OPEN_P2, fairId: fairOpenId, organizationId: orgA.id, createdById: student.id, name: 'OpenSinEval', status: 'APPROVED',
    });
    await createEvaluation({ fairId: fairOpenId, projectId: OPEN_P1, juryUserId: JURY_A, rubricId: rubricOpen.id, totalScore: 20 });

    // ── Feria CLOSED en otra organización (orgB) ───────────────────
    fairForeignId = (
      await prisma.fair.create({
        data: { organizationId: orgB.id, name: `Feria Extraña ${runId}`, status: 'OPEN' },
      })
    ).id;

    const rubricForeign = await prisma.fairRubric.create({
      data: { fairId: fairForeignId, name: 'Rúbrica' },
    });
    const juryB = await createUser({ role: 'JURY', organizationId: orgB.id, suffix: 'JuryB' });
    await prisma.fairJuryAssignment.create({
      data: { fairId: fairForeignId, userId: juryB.id, assignedById: adminB.id },
    });
    await createProject({
      id: FOREIGN_P1, fairId: fairForeignId, organizationId: orgB.id, createdById: adminB.id, name: 'Extranjero', status: 'APPROVED',
    });
    await createEvaluation({ fairId: fairForeignId, projectId: FOREIGN_P1, juryUserId: juryB.id, rubricId: rubricForeign.id, totalScore: 17 });
    await prisma.fair.update({ where: { id: fairForeignId }, data: { status: 'CLOSED' } });

    // ── Feria CLOSED dedicada al flujo de PUBLICACIÓN (orgA) ──────
    fairClosed2Id = (
      await prisma.fair.create({
        data: { organizationId: orgA.id, name: `Feria a Publicar ${runId}`, status: 'OPEN' },
      })
    ).id;
    const rubricClosed2 = await prisma.fairRubric.create({
      data: { fairId: fairClosed2Id, name: 'Rúbrica' },
    });
    await asignarEvaluadores(fairClosed2Id);
    await createProject({
      id: CLOSED2_P1, fairId: fairClosed2Id, organizationId: orgA.id, createdById: student.id, name: 'Publicado', status: 'APPROVED',
    });
    await evaluar({ fairId: fairClosed2Id, projectId: CLOSED2_P1, rubricId: rubricClosed2.id, scores: [10, 10] });
    await prisma.fair.update({ where: { id: fairClosed2Id }, data: { status: 'CLOSED' } });

    adminAToken = await login(adminA.email);
    adminBToken = await login(adminB.email);
    superToken = await login(superAdmin.email);
    studentToken = await login(student.email);
    teacherToken = await login(teacher.email);
    electoralCommissionToken = await login(ec.email);
    juryToken = await login(juryA.email);
    juryCToken = await login(juryC.email);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const getResults = (token, fairId) =>
    request(app)
      .get(`/api/fairs/${fairId}/results`)
      .set('Authorization', `Bearer ${token}`);

  describe('Autorización de GET /results (10, 18, 19, 20)', () => {
    it('10. GET feria inexistente → 404', async () => {
      const res = await getResults(adminAToken, '99999999-9999-4999-8999-999999999999');
      expect(res.status).toBe(404);
    });

    it('GET. ADMIN de otra organización → 403 (tenant)', async () => {
      const res = await getResults(adminAToken, fairForeignId);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('GET. STUDENT / TEACHER / ELECTORAL_COMMISSION → 403', async () => {
      expect((await getResults(studentToken, fairClosedId)).status).toBe(403);
      expect((await getResults(teacherToken, fairClosedId)).status).toBe(403);
      expect((await getResults(electoralCommissionToken, fairClosedId)).status).toBe(403);
    });

    it('18. JURY NO obtiene acceso a resultados por ser jurado (sigue 403)', async () => {
      const res = await getResults(juryToken, fairClosedId);
      expect(res.status).toBe(403);
    });

    it('19. ADMIN de la organización propietaria de la feria → 200', async () => {
      const res = await getResults(adminBToken, fairForeignId);
      expect(res.status).toBe(200);
      expect(res.body.data.fair_status).toBe('CLOSED');
    });

    it('20. SUPERADMIN mantiene el bypass de tenant (accede a feria de orgB)', async () => {
      const res = await getResults(superToken, fairForeignId);
      expect(res.status).toBe(200);
      expect(res.body.data.fair_id).toBe(fairForeignId);
    });
  });

  describe('Feria CLOSED sin publicar (ranking derivado)', () => {
    it('7. CLOSED → ranking disponible con estructura esperada', async () => {
      const res = await getResults(adminAToken, fairClosedId);
      expect(res.status).toBe(200);
      expect(res.body.data.fair_id).toBe(fairClosedId);
      expect(res.body.data.fair_status).toBe('CLOSED');
      expect(Array.isArray(res.body.data.ranking)).toBe(true);
      expect(res.body.data.ranking.length).toBe(5); // solo APP (P1,P2,P3,P4,P5)
    });

    it('11. winner=false en feria CLOSED SIN publicar (aunque haya posición 1)', async () => {
      const res = await getResults(adminAToken, fairClosedId);
      expect(res.body.data.published).toBe(false);
      expect(res.body.data.published_at).toBeNull();
      expect(res.body.data.published_by).toBeNull();
      expect(res.body.data.ranking[0].project_id).toBe(P2);
      expect(res.body.data.ranking[0].position).toBe(1);
      expect(res.body.data.ranking.every((e) => e.winner === false)).toBe(true);
    });

    it('9. promedio correcto a partir de los total_score (18+19+17 → 18)', async () => {
      const res = await getResults(adminAToken, fairClosedId);
      const p1 = res.body.data.ranking.find((e) => e.project_id === P1);
      expect(p1.average_score).toBe(18);
      expect(p1.evaluation_count).toBe(3);
    });

    it('10. ranking ordena por promedio DESC (Bravo 19.00 primero)', async () => {
      const res = await getResults(adminAToken, fairClosedId);
      const ranking = res.body.data.ranking;
      const averages = ranking.filter((e) => e.average_score !== null).map((e) => e.average_score);
      const sorted = [...averages].sort((a, b) => b - a);
      expect(averages).toEqual(sorted);
      expect(ranking[0].project_id).toBe(P2);
    });

    it('11. empate de promedio → evaluation_count DESC (P1/P4 18.00×3 antes que P5 18.00×2)', async () => {
      const res = await getResults(adminAToken, fairClosedId);
      const ranking = res.body.data.ranking;
      const idxP1 = ranking.findIndex((e) => e.project_id === P1);
      const idxP4 = ranking.findIndex((e) => e.project_id === P4);
      const idxP5 = ranking.findIndex((e) => e.project_id === P5);
      expect(idxP1).toBeGreaterThan(-1);
      expect(idxP4).toBeGreaterThan(-1);
      expect(idxP5).toBe(idxP1 + 2); // P5 (2 evals) justo después de P1/P4 (3 evals)
    });

    it('12. empate completo (promedio + count) → project.id ASC (P1 antes de P4)', async () => {
      const res = await getResults(adminAToken, fairClosedId);
      const ranking = res.body.data.ranking;
      const idxP1 = ranking.findIndex((e) => e.project_id === P1);
      const idxP4 = ranking.findIndex((e) => e.project_id === P4);
      expect(idxP1).toBe(idxP4 - 1);
      expect(P1 < P4).toBe(true);
    });

    it('8. proyecto sin evaluaciones → average null, count 0, position null (no inventa 0)', async () => {
      const res = await getResults(adminAToken, fairClosedId);
      const p3 = res.body.data.ranking.find((e) => e.project_id === P3);
      expect(p3.average_score).toBeNull();
      expect(p3.evaluation_count).toBe(0);
      expect(p3.position).toBeNull();
      expect(p3.winner).toBe(false);
      expect(p3).toBe(res.body.data.ranking[res.body.data.ranking.length - 1]);
    });

    it('13-16. solo proyectos APPROVED aparecen (DRAFT/SUBMITTED/REJECTED excluidos)', async () => {
      const res = await getResults(adminAToken, fairClosedId);
      const ids = res.body.data.ranking.map((e) => e.project_id);
      expect(ids).toHaveLength(5);
      expect(ids).not.toContain('DraftProj');
      expect(ids).not.toContain('Submitted');
      expect(ids).not.toContain('Rejected');
    });
  });

  describe('Feria OPEN', () => {
    it('6/18. OPEN → informe sin ganador definitivo (winner siempre false, con posición informativa)', async () => {
      const res = await getResults(adminAToken, fairOpenId);
      expect(res.status).toBe(200);
      expect(res.body.data.fair_status).toBe('OPEN');
      expect(res.body.data.ranking.every((e) => e.winner === false)).toBe(true);
      const evaluated = res.body.data.ranking.find((e) => e.project_id === OPEN_P1);
      expect(evaluated.position).toBe(1);
      expect(evaluated.evaluation_count).toBe(1);
    });
  });

  describe('Publicación oficial de resultados (1-20)', () => {
    it('13. antes de publicar → published=false, published_at/published_by null', async () => {
      const res = await getResults(adminAToken, fairClosed2Id);
      expect(res.status).toBe(200);
      expect(res.body.data.published).toBe(false);
      expect(res.body.data.published_at).toBeNull();
      expect(res.body.data.published_by).toBeNull();
      expect(res.body.data.ranking.every((e) => e.winner === false)).toBe(true);
      closed2RankingBefore = res.body.data.ranking;
    });

    it('1/17. PUBLICAR (ADMIN + CLOSED) → 201; el body del cliente (ranking/winner) se IGNORA', async () => {
      const res = await publishResults(adminAToken, fairClosed2Id, {
        ranking: [{ project_id: 'fake-ganador', position: 1, winner: true }],
        winner: 'fake-ganador',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.published).toBe(true);
      expect(typeof res.body.data.published_at).toBe('string');
      expect(res.body.data.published_by.id).toBe(adminAId);
    });

    it('4. publicar dos veces → 409 (no crea duplicados)', async () => {
      const res = await publishResults(adminAToken, fairClosed2Id);
      expect(res.status).toBe(409);
    });

    it('12/14/15/16. tras publicar → winner=true solo posición 1 y ranking sin cambios', async () => {
      const res = await getResults(adminAToken, fairClosed2Id);
      expect(res.status).toBe(200);
      expect(res.body.data.published).toBe(true);
      expect(typeof res.body.data.published_at).toBe('string');
      expect(res.body.data.published_by.first_name).toBe('Fair');
      expect(res.body.data.ranking[0].project_id).toBe(CLOSED2_P1);
      expect(res.body.data.ranking[0].position).toBe(1);
      expect(res.body.data.ranking[0].winner).toBe(true);
      expect(res.body.data.ranking.slice(1).every((e) => e.winner === false)).toBe(true);
      // El orden/valores del ranking NO cambian al publicar (solo el flag winner).
      const before = closed2RankingBefore.map((r) => [r.project_id, r.average_score, r.evaluation_count, r.position]);
      const after = res.body.data.ranking.map((r) => [r.project_id, r.average_score, r.evaluation_count, r.position]);
      expect(after).toEqual(before);
    });

    it('3. PUBLICAR una feria OPEN → 409 (solo CLOSED)', async () => {
      const res = await publishResults(adminAToken, fairOpenId);
      expect(res.status).toBe(409);
    });

    it('5. PUBLICAR en feria de otra organización → 403 (tenant)', async () => {
      const res = await publishResults(adminAToken, fairForeignId);
      expect(res.status).toBe(403);
    });

    it('6-8. STUDENT / TEACHER / ELECTORAL_COMMISSION no pueden publicar → 403', async () => {
      expect((await publishResults(studentToken, fairClosedId)).status).toBe(403);
      expect((await publishResults(teacherToken, fairClosedId)).status).toBe(403);
      expect((await publishResults(electoralCommissionToken, fairClosedId)).status).toBe(403);
    });

    it('9. SUPERADMIN publica con bypass de tenant (feria de orgB) → 201', async () => {
      const res = await publishResults(superToken, fairForeignId);
      expect(res.status).toBe(201);
      expect(res.body.data.published).toBe(true);
    });

    it('10. PUBLICAR feria inexistente → 404', async () => {
      const res = await publishResults(adminAToken, '99999999-9999-4999-8999-999999999999');
      expect(res.status).toBe(404);
    });
  });

  describe('Revisión de proyectos por JURY (21-30)', () => {
    it('21. JURY asignado ve el detalle de un proyecto APPROVED de su feria', async () => {
      const res = await getProjectReview(juryToken, fairClosedId, P2);
      expect(res.status).toBe(200);
      expect(res.body.data.project_id).toBe(P2);
      expect(res.body.data.name).toBe('Bravo');
      expect(res.body.data).toHaveProperty('logo_url');
      expect(res.body.data).toHaveProperty('cover_url');
      expect(res.body.data).toHaveProperty('project_url');
      expect(res.body.data.fair_id).toBe(fairClosedId);
      expect(Array.isArray(res.body.data.members)).toBe(true);
      expect(res.body.data.members[0].role).toBe('EXPOSITOR');
    });

    it('22. JURY sin asignación en la feria → 403', async () => {
      const res = await getProjectReview(juryCToken, fairClosedId, P2);
      expect(res.status).toBe(403);
    });

    it('23. JURY no puede ver un proyecto de OTRA feria → 404', async () => {
      const res = await getProjectReview(juryToken, fairOpenId, P2); // P2 es de fairClosedId
      expect(res.status).toBe(404);
    });

    it('24. proyecto REJECTED no es visible → 404', async () => {
      const res = await getProjectReview(juryToken, fairClosedId, rejectedProjectId);
      expect(res.status).toBe(404);
    });

    it('25. proyecto SUBMITTED no es visible → 404', async () => {
      const res = await getProjectReview(juryToken, fairClosedId, submittedProjectId);
      expect(res.status).toBe(404);
    });

    it('26. proyecto DRAFT no es visible → 404', async () => {
      const res = await getProjectReview(juryToken, fairClosedId, draftProjectId);
      expect(res.status).toBe(404);
    });

    it('27. STUDENT no obtiene acceso al endpoint exclusivo de JURY → 403', async () => {
      const res = await getProjectReview(studentToken, fairClosedId, P2);
      expect(res.status).toBe(403);
    });

    // El detalle es compartido: el ADMIN/SUPERADMIN lo consulta desde la vista
    // de resultados (fairEvaluation.routes.js, READERS), siempre por tenant.
    it('28. ADMIN de la organización de la feria ve el detalle → 200', async () => {
      const res = await getProjectReview(adminAToken, fairClosedId, P2);
      expect(res.status).toBe(200);
    });

    it('28b. ADMIN de otra organización no ve el detalle → 403 (tenant)', async () => {
      const res = await getProjectReview(adminBToken, fairClosedId, P2);
      expect(res.status).toBe(403);
    });

    it('29. SUPERADMIN ve el detalle con bypass de tenant → 200', async () => {
      const res = await getProjectReview(superToken, fairClosedId, P2);
      expect(res.status).toBe(200);
    });

    it('30. el detalle devuelve solo información segura (sin email/documento)', async () => {
      const res = await getProjectReview(juryToken, fairClosedId, P2);
      expect(res.status).toBe(200);
      expect(res.body.data).not.toHaveProperty('email');
      expect(res.body.data).not.toHaveProperty('institutional_id');
      expect(res.body.data).not.toHaveProperty('document_number');
      for (const member of res.body.data.members) {
        expect(member).not.toHaveProperty('email');
        expect(member).not.toHaveProperty('institutional_id');
        expect(member).not.toHaveProperty('document_number');
      }
    });
  });

  describe('Seguridad multi-tenant (reafirmación)', () => {
    it('ADMIN nunca ve resultados de feria de otra organización', async () => {
      const res = await getResults(adminAToken, fairForeignId);
      expect(res.status).toBe(403);
    });

    it('los datos del ranking derivan del backend (el cliente solo envía el id)', async () => {
      const res = await getResults(adminAToken, fairClosedId);
      expect(res.body.data.ranking[0]).not.toHaveProperty('rubric_id');
      expect(res.body.data.ranking[0]).not.toHaveProperty('criterion_id');
    });
  });
});