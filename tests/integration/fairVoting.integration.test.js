/**
 * FairVoting — pruebas de integración HTTP + BD.
 * Cubre los escenarios del Paso 8 referidos a la votación:
 *   9, 10, 11, 12, 13, 14, 15, 16, 17.
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

const PASSWORD = 'FairVoting2Test123!';
const runId = Date.now();

let orgAId;
let categoryOpenId;
let fairOpenId;
let fairClosedId;
let projectAId;
let projectBId;
let adminToken;
let studentToken;
let juryToken;
let juryForeignToken;
let juryClosedToken;

const login = async (email) => {
  const r = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  return r.body.data.token;
};

const createUser = async ({ role, organizationId, suffix }) =>
  prisma.user.create({
    data: {
      username: `fv2.${role.toLowerCase()}.${suffix}.${runId}`,
      email: `fv2.${role.toLowerCase()}.${suffix}.${runId}@campusvote.edu.pe`,
      password: await bcrypt.hash(PASSWORD, 12),
      firstName: role,
      lastName: suffix,
      institutionalId: `FV2${suffix}${runId}`,
      role,
      // chk_users_scope_admin_only: todo ADMIN tiene alcance; el resto, ninguno.
      scopeLevel: role === 'ADMIN' ? 'ORG' : null,
      authProvider: 'LOCAL',
      isVerified: true,
      status: 'ACTIVE',
      mustChangePassword: false,
      organizationId,
    },
  });

async function setup() {
  const orgA = await prisma.organization.create({ data: { name: `OrgA FV2 ${runId}`, code: `ORAFV2${runId}` } });
  const orgB = await prisma.organization.create({ data: { name: `OrgB FV2 ${runId}`, code: `ORBFV2${runId}` } });
  orgAId = orgA.id;

  const admin = await createUser({ role: 'ADMIN', organizationId: orgA.id, suffix: 'Admin' });
  const student = await createUser({ role: 'STUDENT', organizationId: orgA.id, suffix: 'Stud' });
  const jury = await createUser({ role: 'JURY', organizationId: orgA.id, suffix: 'Jury' });
  const juryB = await createUser({ role: 'JURY', organizationId: orgB.id, suffix: 'JuryB' });
  const juryClosed = await createUser({ role: 'JURY', organizationId: orgA.id, suffix: 'JuryC' });

  fairOpenId = (await prisma.fair.create({ data: { organizationId: orgA.id, name: `FV2 Open ${runId}`, status: 'OPEN' } })).id;
  fairClosedId = (await prisma.fair.create({ data: { organizationId: orgA.id, name: `FV2 Closed ${runId}`, status: 'CLOSED' } })).id;

  const juryAssignment = await prisma.fairJuryAssignment.create({ data: { fairId: fairOpenId, userId: jury.id, assignedById: admin.id } });
  // Jurados por categoría (ad55320): el jurado solo vota proyectos de sus
  // categorías, y cada proyecto participante necesita una.
  const categoria = await prisma.fairCategory.create({ data: { fairId: fairOpenId, name: 'Software' } });
  categoryOpenId = categoria.id;
  await prisma.fairJuryCategoryAssignment.create({ data: { juryAssignmentId: juryAssignment.id, categoryId: categoria.id } });
  await prisma.fairJuryAssignment.create({ data: { fairId: fairClosedId, userId: juryClosed.id, assignedById: admin.id } });

  projectAId = (await prisma.project.create({ data: { organizationId: orgA.id, fairId: fairOpenId, createdById: student.id, categoryId: categoria.id, name: 'A', status: 'APPROVED', reviewedAt: new Date() } })).id;
  projectBId = (await prisma.project.create({ data: { organizationId: orgA.id, fairId: fairOpenId, createdById: student.id, categoryId: categoria.id, name: 'B', status: 'APPROVED', reviewedAt: new Date() } })).id;
  await prisma.project.create({ data: { organizationId: orgA.id, fairId: fairClosedId, createdById: admin.id, name: 'ClosedProj', status: 'APPROVED', reviewedAt: new Date() } });

  adminToken = await login(admin.email);
  studentToken = await login(student.email);
  juryToken = await login(jury.email);
  juryForeignToken = await login(juryB.email);
  juryClosedToken = await login(juryClosed.email);
}

describe('FairVoting — Integration', () => {
  beforeAll(setup);
  afterAll(async () => prisma.$disconnect());

  // ── 9. JURY puede votar ────────────────────────────────────────
  describe('Emisión del voto', () => {
    it('status antes de votar: has_voted=false (sin project_id)', async () => {
      const res = await request(app).get(`/api/fairs/${fairOpenId}/voting/status`).set('Authorization', `Bearer ${juryToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.has_voted).toBe(false);
      expect(res.body.data.voted_at).toBeNull();
      // 16. NO expone projectId
      expect(res.body.data).not.toHaveProperty('project_id');
      expect(res.body.data).not.toHaveProperty('projectId');
    });

    it('9. JURY puede votar por un proyecto asignado', async () => {
      const res = await request(app).post(`/api/fairs/${fairOpenId}/votes`).set('Authorization', `Bearer ${juryToken}`).send({ project_id: projectAId });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('CAST');
      expect(res.body.data.receipt_code).toMatch(/^[a-f0-9]{32}$/);
    });

    it('11. JURY NO puede votar dos veces → 409', async () => {
      const res = await request(app).post(`/api/fairs/${fairOpenId}/votes`).set('Authorization', `Bearer ${juryToken}`).send({ project_id: projectBId });
      expect(res.status).toBe(409);
    });

    it('13. Usuario sin rol JURY NO puede votar → 403', async () => {
      const res = await request(app).post(`/api/fairs/${fairOpenId}/votes`).set('Authorization', `Bearer ${studentToken}`).send({ project_id: projectAId });
      expect(res.status).toBe(403);
    });

    it('10. JURY de otra organización NO puede votar en esta feria → 403', async () => {
      const res = await request(app).post(`/api/fairs/${fairOpenId}/votes`).set('Authorization', `Bearer ${juryForeignToken}`).send({ project_id: projectAId });
      expect(res.status).toBe(403);
    });

    it('14. Feria CERRADA NO acepta votos → 409', async () => {
      const projC = await prisma.project.findFirst({ where: { fairId: fairClosedId, name: 'ClosedProj' } });
      const res = await request(app).post(`/api/fairs/${fairClosedId}/votes`).set('Authorization', `Bearer ${juryClosedToken}`).send({ project_id: projC.id });
      expect(res.status).toBe(409);
    });
  });

  // ── 12. Concurrencia (UNIQUE en BD) ────────────────────────────
  describe('Concurrencia', () => {
    it('12. Dos requests simultáneos solo registran un voto', async () => {
      const admin = await prisma.user.findFirst({ where: { email: `fv2.admin.admin.${runId}@campusvote.edu.pe` } });
      const student = await prisma.user.findFirst({ where: { email: `fv2.student.stud.${runId}@campusvote.edu.pe` } });
      const newFair = (await prisma.fair.create({ data: { organizationId: orgAId, name: `FV2 Race ${runId}`, status: 'OPEN' } })).id;
      const j3 = await createUser({ role: 'JURY', organizationId: orgAId, suffix: 'Race' });
      const a3 = await prisma.fairJuryAssignment.create({ data: { fairId: newFair, userId: j3.id, assignedById: admin.id } });
      const catRace = await prisma.fairCategory.create({ data: { fairId: newFair, name: 'Race' } });
      await prisma.fairJuryCategoryAssignment.create({ data: { juryAssignmentId: a3.id, categoryId: catRace.id } });
      const proj = (await prisma.project.create({ data: { organizationId: orgAId, fairId: newFair, createdById: student.id, categoryId: catRace.id, name: 'Race', status: 'APPROVED', reviewedAt: new Date() } })).id;
      const t3 = await login(j3.email);

      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app).post(`/api/fairs/${newFair}/votes`).set('Authorization', `Bearer ${t3}`).send({ project_id: proj })
        )
      );
      const ok = responses.filter((r) => r.status === 201);
      const conflict = responses.filter((r) => r.status === 409);
      expect(ok.length).toBe(1);
      expect(conflict.length).toBe(4);
    });
  });

  // ── 15, 16, 17. Anonimato + resultados ─────────────────────────
  describe('Anonimato y resultados', () => {
    it('15. El comprobante NO revela jurado ni proyecto', async () => {
      const vote = await prisma.fairVote.findFirst({ where: { fairId: fairOpenId } });
      const res = await request(app).get(`/api/fairs/${fairOpenId}/voting/verify/${vote.receiptCode}`);
      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data).not.toHaveProperty('project_id');
      expect(res.body.data).not.toHaveProperty('jury_user_id');
      expect(res.body.data).not.toHaveProperty('projectId');
      expect(res.body.data).not.toHaveProperty('juryUserId');
    });

    it('16. Status después de votar: has_voted=true (sin proyecto)', async () => {
      const res = await request(app).get(`/api/fairs/${fairOpenId}/voting/status`).set('Authorization', `Bearer ${juryToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.has_voted).toBe(true);
      expect(res.body.data.voted_at).not.toBeNull();
      expect(res.body.data).not.toHaveProperty('project_id');
    });

    it('17. Los resultados cuentan correctamente los votos', async () => {
      const admin = await prisma.user.findFirst({ where: { email: `fv2.admin.admin.${runId}@campusvote.edu.pe` } });
      const jury2 = await createUser({ role: 'JURY', organizationId: orgAId, suffix: 'J2' });
      const a2 = await prisma.fairJuryAssignment.create({ data: { fairId: fairOpenId, userId: jury2.id, assignedById: admin.id } });
      await prisma.fairJuryCategoryAssignment.create({ data: { juryAssignmentId: a2.id, categoryId: categoryOpenId } });
      const t2 = await login(jury2.email);
      const v = await request(app).post(`/api/fairs/${fairOpenId}/votes`).set('Authorization', `Bearer ${t2}`).send({ project_id: projectBId });
      expect(v.status).toBe(201);

      const results = await request(app).get(`/api/fairs/${fairOpenId}/voting/results`).set('Authorization', `Bearer ${adminToken}`);
      expect(results.status).toBe(200);
      expect(results.body.data.total_votes).toBe(2);
      const a = results.body.data.projects.find((p) => p.project_id === projectAId);
      const b = results.body.data.projects.find((p) => p.project_id === projectBId);
      expect(a.votes).toBe(1);
      expect(b.votes).toBe(1);
    });
  });
});
