/**
 * Users — pruebas de integración HTTP (app + BD real)
 */
import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createAcademicFixture } from './academic.fixture.js';

jest.unstable_mockModule('../../src/middlewares/rateLimiter.middleware.js', () => ({
  loginLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
}));

const app = (await import('../../src/app.js')).default;
const { prisma } = await import('../../src/database/prisma.js');

const PASSWORD = 'UsersTest123!';
const runId = Date.now();

let adminId;
let studentId;
let targetId;
let adminToken;
let studentToken;
let programId;
let facultyId;

const login = async (email) => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password: PASSWORD });
  return res;
};

describe('Users Integration (HTTP + DB)', () => {
  beforeAll(async () => {
    const hash = await bcrypt.hash(PASSWORD, 12);
    const { faculty, program } = await createAcademicFixture(runId);
    programId = program.id;
    facultyId = faculty.id;

    const admin = await prisma.user.create({
      data: {
        username: `users.admin.${runId}`,
        email: `users.admin.${runId}@campusvote.edu.pe`,
        password: hash,
        firstName: 'Admin',
        lastName: 'Test',
        institutionalId: `UADM${runId}`,
        role: 'ADMIN',
        authProvider: 'LOCAL',
        isVerified: true,
        status: 'ACTIVE',
        mustChangePassword: false,
      },
    });
    adminId = admin.id;

    const student = await prisma.user.create({
      data: {
        username: `users.student.${runId}`,
        email: `users.student.${runId}@campusvote.edu.pe`,
        password: hash,
        firstName: 'Student',
        lastName: 'Test',
        institutionalId: `USTU${runId}`,
        role: 'STUDENT',
        authProvider: 'LOCAL',
        isVerified: true,
        status: 'ACTIVE',
        mustChangePassword: false,
        programId,
        currentCycle: 5,
      },
    });
    studentId = student.id;

    const target = await prisma.user.create({
      data: {
        username: `users.target.${runId}`,
        email: `users.target.${runId}@campusvote.edu.pe`,
        password: hash,
        firstName: 'Target',
        lastName: 'User',
        institutionalId: `UTGT${runId}`,
        role: 'STUDENT',
        authProvider: 'LOCAL',
        isVerified: true,
        status: 'ACTIVE',
        mustChangePassword: false,
        programId,
        facultyId,
        currentCycle: 5,
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 60_000),
      },
    });
    targetId = target.id;

    const adminLogin = await login(admin.email);
    expect(adminLogin.status).toBe(200);
    adminToken = adminLogin.body.data.token;

    const studentLogin = await login(student.email);
    expect(studentLogin.status).toBe(200);
    studentToken = studentLogin.body.data.token;
  });

  afterAll(async () => {
    const idsToDelete = [adminId, studentId, targetId].filter(Boolean);
    if (idsToDelete.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: idsToDelete } },
      }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  describe('Autenticacion requerida', () => {
    it('GET /api/users/me sin token deberia retornar 401', async () => {
      const res = await request(app).get('/api/users/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/users/me', () => {
    it('Deberia retornar perfil del usuario autenticado', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(studentId);
      expect(res.body.data.email).toBe(`users.student.${runId}@campusvote.edu.pe`);
    });

    it('Deberia usar el mismo formato snake_case que GET /api/auth/me', async () => {
      const [usersMe, authMe] = await Promise.all([
        request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${studentToken}`),
        request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${studentToken}`),
      ]);

      expect(usersMe.status).toBe(200);
      expect(authMe.status).toBe(200);
      expect(Object.keys(usersMe.body.data).sort()).toEqual(
        Object.keys(authMe.body.data).sort()
      );
      expect(usersMe.body.data.first_name).toBe(authMe.body.data.first_name);
    });
  });

  describe('GET /api/users (listado)', () => {
    it('Deberia denegar acceso a STUDENT con 403', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Deberia listar usuarios paginados para ADMIN', async () => {
      const res = await request(app)
        .get('/api/users?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.pagination).toEqual(
        expect.objectContaining({
          page: 1,
          limit: 5,
          total: expect.any(Number),
        })
      );
    });
  });

  describe('GET /api/users/:id', () => {
    it('Deberia permitir al estudiante ver su propio perfil', async () => {
      const res = await request(app)
        .get(`/api/users/${studentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(studentId);
    });

    it('Deberia denegar al estudiante ver otro usuario con 403', async () => {
      const res = await request(app)
        .get(`/api/users/${targetId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Deberia permitir al admin ver cualquier usuario', async () => {
      const res = await request(app)
        .get(`/api/users/${targetId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(targetId);
    });

    it('Deberia rechazar id invalido con 400', async () => {
      const res = await request(app)
        .get('/api/users/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('PUT /api/users/me', () => {
    it('Deberia actualizar perfil propio', async () => {
      const res = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ first_name: 'Estudiante', last_name: 'Actualizado' });

      expect(res.status).toBe(200);
      expect(res.body.data.first_name).toBe('Estudiante');
      expect(res.body.data.last_name).toBe('Actualizado');
    });

    it('Deberia rechazar body vacio con 400', async () => {
      const res = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('POST /api/users (crear)', () => {
    const newEmail = `users.created.${runId}@campusvote.edu.pe`;

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { email: newEmail } }).catch(() => {});
    });

    it('Deberia denegar creacion a STUDENT con 403', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          username: `created.by.student.${runId}`,
          email: `fail.${runId}@campusvote.edu.pe`,
          password: 'Password123!',
          first_name: 'Fail',
          last_name: 'User',
          institutional_id: `UFAIL${runId}`,
          role: 'STUDENT',
        });

      expect(res.status).toBe(403);
    });

    it('Deberia crear usuario como ADMIN con 201', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: `users.created.${runId}`,
          email: newEmail,
          password: 'Password123!',
          first_name: 'Creado',
          last_name: 'PorAdmin',
          institutional_id: `UCRT${runId}`,
          role: 'STUDENT',
          program_id: programId,
          current_cycle: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(newEmail);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('Deberia actualizar usuario por id como ADMIN', async () => {
      const res = await request(app)
        .put(`/api/users/${targetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ first_name: 'Target', last_name: 'Modificado' });

      expect(res.status).toBe(200);
      expect(res.body.data.first_name).toBe('Target');
      expect(res.body.data.last_name).toBe('Modificado');
    });
  });

  describe('PATCH /api/users/:id/role', () => {
    it('Deberia cambiar rol como ADMIN', async () => {
      const res = await request(app)
        .patch(`/api/users/${targetId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'TEACHER' });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('TEACHER');
    });
  });

  describe('PATCH /api/users/:id/status', () => {
    it('Deberia desactivar otro usuario como ADMIN', async () => {
      const res = await request(app)
        .patch(`/api/users/${targetId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_active: false });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SUSPENDED');
    });

    it('Deberia impedir que admin se desactive a si mismo', async () => {
      const res = await request(app)
        .patch(`/api/users/${adminId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_active: false });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/users/:id/unlock', () => {
    it('Deberia desbloquear usuario como ADMIN', async () => {
      const res = await request(app)
        .patch(`/api/users/${targetId}/unlock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbUser = await prisma.user.findUnique({
        where: { id: targetId },
        select: { failedLoginAttempts: true, lockedUntil: true },
      });
      expect(dbUser.failedLoginAttempts).toBe(0);
      expect(dbUser.lockedUntil).toBeNull();
    });
  });

  describe('POST /api/users/me/password', () => {
    it('Deberia cambiar contrasena propia', async () => {
      const newPassword = 'NewUsersPass456!';

      const res = await request(app)
        .post('/api/users/me/password')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          current_password: PASSWORD,
          new_password: newPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.changed).toBe(true);

      const loginOld = await request(app)
        .post('/api/auth/login')
        .send({
          email: `users.student.${runId}@campusvote.edu.pe`,
          password: PASSWORD,
        });
      expect(loginOld.status).toBe(401);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: `users.student.${runId}@campusvote.edu.pe`,
          password: newPassword,
        });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.token).toBeDefined();

      studentToken = loginRes.body.data.token;
    });

    it('Deberia rechazar contrasena actual incorrecta con 400', async () => {
      const res = await request(app)
        .post('/api/users/me/password')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          current_password: 'WrongPassword!',
          new_password: 'AnotherPass789!',
        });

      expect(res.status).toBe(400);
    });
  });
}); 