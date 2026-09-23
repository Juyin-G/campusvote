/**
 * FairRubricChecklist — pruebas de integración HTTP + BD.
 * Cubre los escenarios del Paso 8 referidos a la rúbrica:
 *   1, 2, 3, 4, 5, 6, 7, 8.
 */
import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import request from 'supertest';

jest.unstable_mockModule('../../src/middlewares/rateLimiter.middleware.js', () => ({
  loginLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  userLimiter: () => (_req, _res, next) => next(),
}));

const app = (await import('../../src/app.js')).default;
const { prisma } = await import('../../src/database/prisma.js');

const PASSWORD = 'FairRubricTest123!';
const runId = Date.now();

let orgAId;
let categoryId;
let fairOpenId;
let rubricId;
let criterionAId;
let criterionBId;
let projectAId;
let projectBId;
let projectForeignId;
let adminToken;
let studentToken;
let teacherToken;
let juryToken;
let juryForeignToken;

const login = async (email) => {
  const r = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  return r.body.data.token;
};

const createUser = async ({ role, organizationId, suffix }) =>
  prisma.user.create({
    data: {
      username: `fr.${role.toLowerCase()}.${suffix}.${runId}`,
      email: `fr.${role.toLowerCase()}.${suffix}.${runId}@campusvote.edu.pe`,
      password: await bcrypt.hash(PASSWORD, 12),
      firstName: role,
      lastName: suffix,
      institutionalId: `FR${suffix}${runId}`,
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
  const orgA = await prisma.organization.create({ data: { name: `OrgA FR ${runId}`, code: `ORAFR${runId}` } });
  const orgB = await prisma.organization.create({ data: { name: `OrgB FR ${runId}`, code: `ORBFR${runId}` } });
  orgAId = orgA.id;

  const admin = await createUser({ role: 'ADMIN', organizationId: orgA.id, suffix: 'Admin' });
  const adminB = await createUser({ role: 'ADMIN', organizationId: orgB.id, suffix: 'AdminB' });
  const student = await createUser({ role: 'STUDENT', organizationId: orgA.id, suffix: 'Stud' });
  const teacher = await createUser({ role: 'TEACHER', organizationId: orgA.id, suffix: 'Teach' });
  const jury = await createUser({ role: 'JURY', organizationId: orgA.id, suffix: 'Jury' });
  const juryB = await createUser({ role: 'JURY', organizationId: orgB.id, suffix: 'JuryB' });

  // La rúbrica solo se configura en DRAFT (fairEvaluation.access.js): se arma
  // primero y la feria se abre después, antes de las pruebas.
  fairOpenId = (await prisma.fair.create({
    data: { organizationId: orgA.id, name: `FR Open ${runId}`, status: 'DRAFT' },
  })).id;

  const juryAssignment = await prisma.fairJuryAssignment.create({
    data: { fairId: fairOpenId, userId: jury.id, assignedById: admin.id },
  });
  // Jurados por categoría (ad55320): el jurado solo responde proyectos de sus
  // categorías, y cada proyecto participante necesita una.
  const categoria = await prisma.fairCategory.create({ data: { fairId: fairOpenId, name: 'Software' } });
  await prisma.fairJuryCategoryAssignment.create({
    data: { juryAssignmentId: juryAssignment.id, categoryId: categoria.id },
  });
  categoryId = categoria.id;

  const rubricRes = await request(app)
    .post(`/api/fairs/${fairOpenId}/rubric`)
    .set('Authorization', `Bearer ${await login(admin.email)}`)
    .send({ name: 'Rúbrica de exposición' });
  rubricId = rubricRes.body.data.id;
  const c1 = await request(app).post(`/api/fairs/${fairOpenId}/rubric/criteria`).set('Authorization', `Bearer ${await login(admin.email)}`).send({ name: 'Explica el problema' });
  criterionAId = c1.body.data.id;
  const c2 = await request(app).post(`/api/fairs/${fairOpenId}/rubric/criteria`).set('Authorization', `Bearer ${await login(admin.email)}`).send({ name: 'Demuestra funcionamiento' });
  criterionBId = c2.body.data.id;
  await prisma.fair.update({ where: { id: fairOpenId }, data: { status: 'OPEN' } });
  // Proyectos después de abrir: 018_fair_open_validation impide abrir una
  // feria con proyectos participantes sin categoría.
  projectAId = (await prisma.project.create({
    data: { organizationId: orgA.id, fairId: fairOpenId, createdById: student.id, categoryId, name: 'Proyecto A', status: 'APPROVED', reviewedAt: new Date() },
  })).id;
  projectBId = (await prisma.project.create({
    data: { organizationId: orgA.id, fairId: fairOpenId, createdById: student.id, categoryId, name: 'Proyecto B', status: 'APPROVED', reviewedAt: new Date() },
  })).id;
  projectForeignId = (await prisma.project.create({
    data: { organizationId: orgB.id, fairId: (await prisma.fair.create({ data: { organizationId: orgB.id, name: `FR Foreign ${runId}`, status: 'OPEN' } })).id, createdById: adminB.id, name: 'Extranjero', status: 'APPROVED', reviewedAt: new Date() },
  })).id;


  adminToken = await login(admin.email);
  studentToken = await login(student.email);
  teacherToken = await login(teacher.email);
  juryToken = await login(jury.email);
  juryForeignToken = await login(juryB.email);
}

describe('FairRubricChecklist — Integration', () => {
  // Crea seis usuarios con bcrypt y hace varios logins: en paralelo con toda
  // la suite supera los 30 s por defecto.
  beforeAll(setup, 120000);
  afterAll(async () => prisma.$disconnect());

  // ── 1, 2, 3: ADMIN gestiona, JURY consulta ─────────────────────
  describe('Rúbrica (ADMIN/JURY)', () => {
    // Los criterios se crearon en DRAFT (setup); abierta la feria la rúbrica
    // se congela para que todos los jurados evalúen con las mismas reglas.
    it('1. con la feria abierta el ADMIN ya no agrega criterios → 409', async () => {
      const res = await request(app).post(`/api/fairs/${fairOpenId}/rubric/criteria`).set('Authorization', `Bearer ${adminToken}`).send({ name: 'Otro criterio' });
      expect(res.status).toBe(409);
    });

    it('2. con la feria abierta el ADMIN ya no edita criterios → 409', async () => {
      const res = await request(app).put(`/api/fairs/${fairOpenId}/rubric/criteria/${criterionAId}`).set('Authorization', `Bearer ${adminToken}`).send({ name: 'Explica claramente el problema' });
      expect(res.status).toBe(409);
    });

    it('3. JURY puede consultar la rúbrica', async () => {
      const res = await request(app).get(`/api/fairs/${fairOpenId}/rubric`).set('Authorization', `Bearer ${juryToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.criteria.length).toBeGreaterThanOrEqual(2);
    });

    it('5. JURY NO puede modificar ni crear criterios → 403', async () => {
      expect((await request(app).put(`/api/fairs/${fairOpenId}/rubric/criteria/${criterionAId}`).set('Authorization', `Bearer ${juryToken}`).send({ name: 'hack' })).status).toBe(403);
      expect((await request(app).post(`/api/fairs/${fairOpenId}/rubric/criteria`).set('Authorization', `Bearer ${juryToken}`).send({ name: 'hack' })).status).toBe(403);
    });

    it('STUDENT/TEACHER NO pueden consultar la rúbrica → 403', async () => {
      expect((await request(app).get(`/api/fairs/${fairOpenId}/rubric`).set('Authorization', `Bearer ${studentToken}`)).status).toBe(403);
      expect((await request(app).get(`/api/fairs/${fairOpenId}/rubric`).set('Authorization', `Bearer ${teacherToken}`)).status).toBe(403);
    });
  });

  // ── 4, 7, 8: respuestas + finalización ─────────────────────────
  describe('Respuestas de rúbrica (JURY)', () => {
    it('4. JURY puede guardar respuestas (booleans)', async () => {
      const res = await request(app).put(`/api/fairs/${fairOpenId}/projects/${projectAId}/rubric`).set('Authorization', `Bearer ${juryToken}`).send({
        responses: [
          { criterion_id: criterionAId, checked: true },
          { criterion_id: criterionBId, checked: false },
        ],
      });
      expect(res.status).toBe(200);
      expect(res.body.data.responses.length).toBe(2);
      expect(res.body.data.submitted).toBe(false);
    });

    it('7. No se puede finalizar con respuestas incompletas → 400', async () => {
      const res = await request(app).put(`/api/fairs/${fairOpenId}/projects/${projectBId}/rubric`).set('Authorization', `Bearer ${juryToken}`).send({
        responses: [{ criterion_id: criterionAId, checked: true }],
        finalize: true,
      });
      expect(res.status).toBe(400);
    });

    it('Finalizar rúbrica completa → submitted=true', async () => {
      const res = await request(app).put(`/api/fairs/${fairOpenId}/projects/${projectBId}/rubric`).set('Authorization', `Bearer ${juryToken}`).send({
        responses: [
          { criterion_id: criterionAId, checked: true },
          { criterion_id: criterionBId, checked: true },
        ],
        finalize: true,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.submitted).toBe(true);
      expect(res.body.data.submitted_at).not.toBeNull();
    });

    it('8. Una rúbrica finalizada NO puede modificarse → 409', async () => {
      const res = await request(app).put(`/api/fairs/${fairOpenId}/projects/${projectBId}/rubric`).set('Authorization', `Bearer ${juryToken}`).send({
        responses: [
          { criterion_id: criterionAId, checked: false },
          { criterion_id: criterionBId, checked: false },
        ],
      });
      expect(res.status).toBe(409);
    });

    // juryCategoryAccess (jurados por categoría) corre primero y responde 404:
    // dentro de esta feria ese proyecto no existe.
    it('6. JURY NO puede responder proyectos de OTRA feria → 404', async () => {
      const res = await request(app).put(`/api/fairs/${fairOpenId}/projects/${projectForeignId}/rubric`).set('Authorization', `Bearer ${juryToken}`).send({
        responses: [
          { criterion_id: criterionAId, checked: true },
          { criterion_id: criterionBId, checked: true },
        ],
      });
      expect(res.status).toBe(404);
    });
  });
});
