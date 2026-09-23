/**
 * FairEngagement — pruebas de integración HTTP + BD.
 * Cubre los 5 ajustes pedidos:
 *   1. POST/DELETE Like explícito (no toggle).
 *   2. Validación estricta projectId ↔ fairId.
 *   3. Límites y autorización de comentarios.
 *   4. Anonimato controlado por backend.
 *   5. Hitos sin notificaciones duplicadas.
 */
import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.unstable_mockModule('../../src/middlewares/rateLimiter.middleware.js', () => ({
  loginLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  userLimiter: () => (_req, _res, next) => next(),
}));

const app = (await import('../../src/app.js')).default;
const { prisma } = await import('../../src/database/prisma.js');
const env = (await import('../../src/config/env.js')).default;

const PASSWORD = 'FairEngagementTest123!';
const runId = Date.now();

let orgAId;
let fairOpenId;
let fairClosedId;
let projectAId;
let projectBId;
let projectClosedId;
let rubricId;
let criterionAId;

let adminToken;
let studentToken;
let teacherToken;
let juryToken;
let jury2Token;
let juryNoAssignToken;

const makeToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      scopeLevel: user.scopeLevel ?? null,
      isSuperuser: user.isSuperuser ?? false,
      isStaff: user.isStaff ?? false,
    },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

// Firma directa (policy 2FA estricto: el login no emite JWT a roles no-SUPERADMIN).
const login = async (email) => makeToken(await prisma.user.findUnique({ where: { email } }));

const createUser = async ({ role, organizationId, suffix, facultyId }) =>
  prisma.user.create({
    data: {
      username: `fe.${role.toLowerCase()}.${suffix}.${runId}`,
      email: `fe.${role.toLowerCase()}.${suffix}.${runId}@campusvote.edu.pe`,
      password: await bcrypt.hash(PASSWORD, 12),
      firstName: role,
      lastName: suffix,
      institutionalId: `FE${suffix}${runId}`,
      role,
      scopeLevel: role === 'ADMIN' ? 'ORG' : undefined,
      facultyId: role === 'TEACHER' ? facultyId : undefined,
      authProvider: 'LOCAL',
      isVerified: true,
      status: 'ACTIVE',
      mustChangePassword: false,
      organizationId,
    },
  });

async function setup() {
  const orgA = await prisma.organization.create({
    data: { name: `OrgA FE ${runId}`, code: `ORAFE${runId}` },
  });
  orgAId = orgA.id;

  const faculty = await prisma.faculty.create({
    data: { name: `Fac FE ${runId}`, code: `FCFE${runId}` },
  });

  const admin = await createUser({ role: 'ADMIN', organizationId: orgA.id, suffix: 'Admin', facultyId: faculty.id });
  const student = await createUser({ role: 'STUDENT', organizationId: orgA.id, suffix: 'Stud', facultyId: faculty.id });
  const teacher = await createUser({ role: 'TEACHER', organizationId: orgA.id, suffix: 'Teach', facultyId: faculty.id });
  const jury = await createUser({ role: 'JURY', organizationId: orgA.id, suffix: 'Jury', facultyId: faculty.id });
  const jury2 = await createUser({ role: 'JURY', organizationId: orgA.id, suffix: 'Jury2', facultyId: faculty.id });
  const juryNo = await createUser({ role: 'JURY', organizationId: orgA.id, suffix: 'JuryNo', facultyId: faculty.id });

  fairOpenId = (await prisma.fair.create({
    data: { organizationId: orgA.id, name: `FE Open ${runId}`, status: 'OPEN' },
  })).id;

  fairClosedId = (await prisma.fair.create({
    data: { organizationId: orgA.id, name: `FE Closed ${runId}`, status: 'CLOSED' },
  })).id;

  await prisma.fairJuryAssignment.create({
    data: { fairId: fairOpenId, userId: jury.id, assignedById: admin.id },
  });
  await prisma.fairJuryAssignment.create({
    data: { fairId: fairOpenId, userId: jury2.id, assignedById: admin.id },
  });
  // juryNo NO está asignado en ninguna feria.

  projectAId = (await prisma.project.create({
    data: {
      organizationId: orgA.id,
      fairId: fairOpenId,
      createdById: student.id,
      name: 'Proyecto A',
      status: 'APPROVED',
      reviewedAt: new Date(),
    },
  })).id;

  projectBId = (await prisma.project.create({
    data: {
      organizationId: orgA.id,
      fairId: fairOpenId,
      createdById: student.id,
      name: 'Proyecto B',
      status: 'APPROVED',
      reviewedAt: new Date(),
    },
  })).id;

  projectClosedId = (await prisma.project.create({
    data: {
      organizationId: orgA.id,
      fairId: fairClosedId,
      createdById: student.id,
      name: 'Proyecto Closed',
      status: 'APPROVED',
      reviewedAt: new Date(),
    },
  })).id;

  // Crear rúbrica con un criterio activo (necesario para fairEvaluations? no — solo engagement usa /projects/:id).
  rubricId = (await prisma.fairRubric.create({
    data: { fairId: fairOpenId, name: 'Rúbrica' },
  })).id;
  criterionAId = (await prisma.rubricCriterion.create({
    data: { rubricId, name: 'Criterio A', position: 1, isActive: true },
  })).id;

  adminToken = await login(admin.email);
  studentToken = await login(student.email);
  teacherToken = await login(teacher.email);
  juryToken = await login(jury.email);
  jury2Token = await login(jury2.email);
  juryNoAssignToken = await login(juryNo.email);
}

describe('FairEngagement — Integration', () => {
  beforeAll(setup);
  afterAll(async () => prisma.$disconnect());

  // ── Like ───────────────────────────────────────────────────────────
  describe('POST/DELETE Like (no toggle)', () => {
    it('1. POST da Me gusta (idempotente: segunda llamada NO duplica)', async () => {
      const r1 = await request(app)
        .post(`/api/fairs/${fairOpenId}/projects/${projectAId}/like`)
        .set('Authorization', `Bearer ${juryToken}`);
      expect(r1.status).toBe(201);
      expect(r1.body.data.has_liked).toBe(true);
      expect(r1.body.data.already_liked).toBe(false);

      const r2 = await request(app)
        .post(`/api/fairs/${fairOpenId}/projects/${projectAId}/like`)
        .set('Authorization', `Bearer ${juryToken}`);
      expect(r2.status).toBe(201);
      expect(r2.body.data.already_liked).toBe(true);
    });

    it('DELETE quita el Me gusta', async () => {
      const r = await request(app)
        .delete(`/api/fairs/${fairOpenId}/projects/${projectAId}/like`)
        .set('Authorization', `Bearer ${juryToken}`);
      expect(r.status).toBe(200);
      expect(r.body.data.has_liked).toBe(false);
      expect(r.body.data.removed).toBe(true);
    });

    it('GET count devuelve count + has_liked (JURY)', async () => {
      await request(app)
        .post(`/api/fairs/${fairOpenId}/projects/${projectAId}/like`)
        .set('Authorization', `Bearer ${juryToken}`);
      const r = await request(app)
        .get(`/api/fairs/${fairOpenId}/projects/${projectAId}/likes/count`)
        .set('Authorization', `Bearer ${juryToken}`);
      expect(r.status).toBe(200);
      expect(r.body.data.count).toBeGreaterThanOrEqual(1);
      expect(r.body.data.has_liked).toBe(true);
    });

    it('JURY sin asignación NO puede dar Me gusta → 403', async () => {
      const r = await request(app)
        .post(`/api/fairs/${fairOpenId}/projects/${projectAId}/like`)
        .set('Authorization', `Bearer ${juryNoAssignToken}`);
      expect(r.status).toBe(403);
    });

    it('STUDENT NO puede dar Me gusta → 403', async () => {
      const r = await request(app)
        .post(`/api/fairs/${fairOpenId}/projects/${projectAId}/like`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(r.status).toBe(403);
    });

    it('2. Validación estricta: projectId de OTRA feria → 404', async () => {
      const r = await request(app)
        .post(`/api/fairs/${fairOpenId}/projects/${projectClosedId}/like`)
        .set('Authorization', `Bearer ${juryToken}`);
      expect(r.status).toBe(404);
    });

    it('Feria CLOSED: like falla por trigger (409)', async () => {
      // Crear asignación del jury a la feria cerrada para llegar al chequeo de estado
      const admin = await prisma.user.findFirst({ where: { email: `fe.admin.admin.${runId}@campusvote.edu.pe` } });
      const jury = await prisma.user.findFirst({ where: { email: `fe.jury.jury.${runId}@campusvote.edu.pe` } });
      const closedJury = await createUser({ role: 'JURY', organizationId: orgAId, suffix: 'CJ' });
      await prisma.fairJuryAssignment.create({
        data: { fairId: fairClosedId, userId: closedJury.id, assignedById: admin.id },
      });
      const t = await login(closedJury.email);
      const r = await request(app)
        .post(`/api/fairs/${fairClosedId}/projects/${projectClosedId}/like`)
        .set('Authorization', `Bearer ${t}`);
      expect(r.status).toBe(409);
    });
  });

  // ── Comments ──────────────────────────────────────────────────────
  describe('CRUD de comentarios', () => {
    it('3a. JURY puede crear comentario (>= 10 chars)', async () => {
      const r = await request(app)
        .post(`/api/fairs/${fairOpenId}/projects/${projectAId}/comments`)
        .set('Authorization', `Bearer ${juryToken}`)
        .send({ comment: 'Me pareció muy buena la exposición.' });
      expect(r.status).toBe(201);
      expect(r.body.data.comment).toContain('exposición');
      expect(r.body.data.is_anonymous).toBe(true);
      expect(r.body.data.jury.first_name).toBeTruthy();
    });

    it('3b. Comentario corto (<10 chars) → 400', async () => {
      const r = await request(app)
        .post(`/api/fairs/${fairOpenId}/projects/${projectAId}/comments`)
        .set('Authorization', `Bearer ${juryToken}`)
        .send({ comment: 'corto' });
      expect(r.status).toBe(400);
    });

    it('3c. Comentario muy largo (>1000 chars) → 400', async () => {
      const longText = 'a'.repeat(1001);
      const r = await request(app)
        .post(`/api/fairs/${fairOpenId}/projects/${projectAId}/comments`)
        .set('Authorization', `Bearer ${juryToken}`)
        .send({ comment: longText });
      expect(r.status).toBe(400);
    });

    it('3d. Solo el autor puede editar su comentario', async () => {
      // jury crea, jury2 intenta editar → 403.
      const created = await request(app)
        .post(`/api/fairs/${fairOpenId}/projects/${projectBId}/comments`)
        .set('Authorization', `Bearer ${juryToken}`)
        .send({ comment: 'Comentario original de jury.' });
      const cid = created.body.data.id;

      const editOther = await request(app)
        .patch(`/api/fairs/${fairOpenId}/comments/${cid}`)
        .set('Authorization', `Bearer ${jury2Token}`)
        .send({ comment: 'Hackeado por jury2.' });
      expect(editOther.status).toBe(403);

      const editOwn = await request(app)
        .patch(`/api/fairs/${fairOpenId}/comments/${cid}`)
        .set('Authorization', `Bearer ${juryToken}`)
        .send({ comment: 'Comentario editado por su autor.' });
      expect(editOwn.status).toBe(200);
      expect(editOwn.body.data.comment).toContain('editado');
    });

    it('3e. STUDENT NO puede comentar → 403', async () => {
      const r = await request(app)
        .post(`/api/fairs/${fairOpenId}/projects/${projectAId}/comments`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ comment: 'Comentario de un estudiante' });
      expect(r.status).toBe(403);
    });

    it('4a. JURY ve comentarios CON autor', async () => {
      const r = await request(app)
        .get(`/api/fairs/${fairOpenId}/projects/${projectAId}/comments`)
        .set('Authorization', `Bearer ${jury2Token}`);
      expect(r.status).toBe(200);
      expect(r.body.data.length).toBeGreaterThan(0);
      expect(r.body.data[0].jury).toBeTruthy();
      expect(r.body.data[0].jury.first_name).toBeTruthy();
    });

    it('4b. STUDENT (integrante) ve comentarios SIN autor (anonimato)', async () => {
      const r = await request(app)
        .get(`/api/fairs/${fairOpenId}/projects/${projectAId}/comments`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(r.status).toBe(200);
      expect(r.body.data.length).toBeGreaterThan(0);
      // NO debe contener jury en ninguna entrada.
      for (const c of r.body.data) {
        expect(c).not.toHaveProperty('jury');
      }
    });

    it('4c. TEACHER (no integrante) ve comentarios SIN autor', async () => {
      const r = await request(app)
        .get(`/api/fairs/${fairOpenId}/projects/${projectAId}/comments`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(r.status).toBe(200);
      for (const c of r.body.data) {
        expect(c).not.toHaveProperty('jury');
      }
    });

    it('4d. ADMIN ve comentarios CON autor', async () => {
      const r = await request(app)
        .get(`/api/fairs/${fairOpenId}/projects/${projectAId}/comments`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(r.status).toBe(200);
      expect(r.body.data[0].jury).toBeTruthy();
    });
  });

  // ── Hitos ─────────────────────────────────────────────────────────
  describe('Hitos de Me gusta (10, 20, 30...)', () => {
    it('5a. Primer hito es 10 (count=9 no notifica, count=10 sí)', async () => {
      // Limpiar estado previo
      await prisma.fairProjectLike.deleteMany({ where: { projectId: projectBId } });
      await prisma.fairProjectLikeMilestone.deleteMany({ where: { projectId: projectBId } });

      // Insertar 9 likes directos vía prisma.
      const fakeIds = [];
      for (let i = 0; i < 9; i++) {
        const j = await createUser({ role: 'JURY', organizationId: orgAId, suffix: `M${i}` });
        fakeIds.push(j.id);
        const admin = await prisma.user.findFirst({
          where: { email: `fe.admin.admin.${runId}@campusvote.edu.pe` },
        });
        await prisma.fairJuryAssignment.create({
          data: { fairId: fairOpenId, userId: j.id, assignedById: admin.id },
        });
      }
      await prisma.fairProjectLike.createMany({
        data: fakeIds.map((uid) => ({
          fairId: fairOpenId,
          projectId: projectBId,
          juryUserId: uid,
        })),
      });

      // count = 9 → ningún hito (mínimo 10).
      const milestones0 = await prisma.fairProjectLikeMilestone.count({
        where: { projectId: projectBId },
      });
      expect(milestones0).toBe(0);

      // Insertar 1 más (total 10) → hito 10.
      const extra = await createUser({ role: 'JURY', organizationId: orgAId, suffix: 'M9' });
      const admin2 = await prisma.user.findFirst({
        where: { email: `fe.admin.admin.${runId}@campusvote.edu.pe` },
      });
      await prisma.fairJuryAssignment.create({
        data: { fairId: fairOpenId, userId: extra.id, assignedById: admin2.id },
      });
      // Llamamos al endpoint POST de like — fuerza la lógica de hito.
      const t = await login(extra.email);
      const r = await request(app)
        .post(`/api/fairs/${fairOpenId}/projects/${projectBId}/like`)
        .set('Authorization', `Bearer ${t}`);
      expect(r.status).toBe(201);

      const milestones10 = await prisma.fairProjectLikeMilestone.findMany({
        where: { projectId: projectBId },
      });
      expect(milestones10.find((m) => m.milestone === 10)).toBeDefined();
    });

    it('5b. Dedupe: el mismo hito no se inserta dos veces', async () => {
      // El hito 10 ya está marcado del test anterior.
      const before = await prisma.fairProjectLikeMilestone.count({
        where: { projectId: projectBId, milestone: 10 },
      });
      expect(before).toBe(1);

      // Forzar otro intento de marcado.
      try {
        await prisma.fairProjectLikeMilestone.create({
          data: { projectId: projectBId, milestone: 10 },
        });
      } catch (err) {
        // Esperamos UNIQUE violation.
        expect(err.code).toBe('P2002');
      }

      const after = await prisma.fairProjectLikeMilestone.count({
        where: { projectId: projectBId, milestone: 10 },
      });
      expect(after).toBe(1);
    });
  });

  // ── Vista de engagement para integrantes ─────────────────────────
  describe('GET engagement (integrantes del proyecto)', () => {
    it('Integrante del proyecto ve likes_count + comments (sin autor)', async () => {
      const r = await request(app)
        .get(`/api/fairs/${fairOpenId}/projects/${projectAId}/engagement`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(r.status).toBe(200);
      expect(r.body.data).toHaveProperty('likes_count');
      expect(r.body.data).toHaveProperty('comments');
      for (const c of r.body.data.comments) {
        expect(c).not.toHaveProperty('jury');
      }
    });

    it('Usuario SIN membresía NO puede ver engagement → 403', async () => {
      // Crear un estudiante que NO es miembro del proyecto.
      const outsider = await createUser({
        role: 'STUDENT',
        organizationId: orgAId,
        suffix: 'Outsider',
      });
      const t = await login(outsider.email);
      const r = await request(app)
        .get(`/api/fairs/${fairOpenId}/projects/${projectAId}/engagement`)
        .set('Authorization', `Bearer ${t}`);
      expect(r.status).toBe(403);
    });

    it('ADMIN puede ver engagement (moderación)', async () => {
      const r = await request(app)
        .get(`/api/fairs/${fairOpenId}/projects/${projectAId}/engagement`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(r.status).toBe(200);
    });

    it('JURY asignado puede ver engagement', async () => {
      const r = await request(app)
        .get(`/api/fairs/${fairOpenId}/projects/${projectAId}/engagement`)
        .set('Authorization', `Bearer ${jury2Token}`);
      expect(r.status).toBe(200);
    });
  });
});
