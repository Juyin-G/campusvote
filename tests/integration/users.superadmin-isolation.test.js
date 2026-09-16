// tests/integration/users.superadmin-isolation.test.js
//
// Verifica el requisito de CONTROL DE USUARIOS ACADÉMICOS:
//   - SUPERADMIN NO tiene acceso al CRUD de usuarios de tenant.
//   - ADMIN ORG/REGION/SITE solo puede operar dentro de su scope.
//
// Se ejecuta contra el backend real (HTTP). Usa el cliente Prisma para
// crear fixtures mínimos y firma el JWT con el helper del backend.

import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import * as jwtHelpers from '../../src/modules/auth/services/auth.helpers.js';

const PASSWORD = 'P@ssw0rd-test-provision!';

const signActor = (payload) => jwtHelpers.generateJwt({
  userId: payload.userId,
  email: payload.email,
  role: payload.role,
  organizationId: payload.organizationId ?? null,
  isSuperuser: payload.isSuperuser ?? false,
  isStaff: payload.isStaff ?? false,
  username: payload.username ?? payload.email,
  isVerified: true,
});

describe('Tenancy isolation del CRUD de usuarios', () => {
  let superAdminToken;
  let adminOrgToken;

  beforeAll(async () => {
    // Verify Prisma is connected to the TEST database.
    const dbInfo = await prisma.$queryRaw`SELECT current_database() AS db`;
    console.log('[TEST] Prisma connected to:', dbInfo);

    // SUPERADMIN global (no pertenece a ninguna organización).
    const saUser = await prisma.user.create({
      data: {
        username: 'users.iso.superadmin',
        email: 'users.iso.superadmin@campusvote.edu.pe',
        password: '$2a$12$dummyhashplaceholderfortest00.xxxxxxxxxxxxxxxxxxxxxxx',
        firstName: 'SA',
        lastName: 'Iso',
        institutionalId: 'ISO-SA-001',
        role: 'SUPERADMIN',
        isSuperuser: true,
        isStaff: true,
        status: 'ACTIVE',
      },
    });
    superAdminToken = signActor({
      userId: saUser.id,
      email: saUser.email,
      role: 'SUPERADMIN',
      isSuperuser: true,
      isStaff: true,
    });

    // ADMIN ORG con scope.
    const org = await prisma.organization.findFirst();
    const adminOrgUser = await prisma.user.create({
      data: {
        username: 'users.iso.adminorg',
        email: 'users.iso.adminorg@campusvote.edu.pe',
        password: '$2a$12$dummyhashplaceholderfortest00.xxxxxxxxxxxxxxxxxxxxxxx',
        firstName: 'AdminOrg',
        lastName: 'Iso',
        institutionalId: 'ISO-AO-001',
        role: 'ADMIN',
        organizationId: org.id,
        scopeLevel: 'ORG',
        status: 'ACTIVE',
      },
    });
    adminOrgToken = signActor({
      userId: adminOrgUser.id,
      email: adminOrgUser.email,
      role: 'ADMIN',
      organizationId: org.id,
    });
  });

  afterAll(async () => {
    // Limpieza best-effort sin disparar el trigger de audit_logs.
    await prisma.userSiteAssignment.deleteMany({ where: { user: { email: { contains: 'users.iso.' } } } });
    await prisma.$disconnect();
  });

  test('SUPERADMIN → 403 en GET /api/users (bloqueado por plataforma)', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(403);
  });

  test('SUPERADMIN → 403 en POST /api/users (creación individual)', async () => {
    const org = await prisma.organization.findFirst();
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        username: 'sx',
        email: 'sx@x.com',
        password: PASSWORD,
        first_name: 'X',
        last_name: 'Y',
        institutional_id: 'X-1',
        role: 'STUDENT',
        organization_id: org.id,
      });
    expect(res.status).toBe(403);
  });

  test('SUPERADMIN → 403 en POST /api/users/bulk (carga masiva)', async () => {
    const org = await prisma.organization.findFirst();
    const res = await request(app)
      .post('/api/users/bulk')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        organization_id: org.id,
        users: [
          {
            username: 'bulkiso1',
            email: 'bulkiso1@x.com',
            password: PASSWORD,
            first_name: 'X',
            last_name: 'Y',
            role: 'STUDENT',
          },
        ],
      });
    expect(res.status).toBe(403);
  });

  test('SUPERADMIN → 403 en PATCH /api/users/:id/status', async () => {
    const target = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
    const res = await request(app)
      .patch(`/api/users/${target.id}/status`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ is_active: false });
    expect(res.status).toBe(403);
  });

  test('SUPERADMIN → 403 en PATCH /api/users/:id/unlock', async () => {
    const target = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
    const res = await request(app)
      .patch(`/api/users/${target.id}/unlock`)
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(403);
  });

  test('SUPERADMIN → 403 en PUT /api/users/:id/site (asignación de sede)', async () => {
    const target = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
    const res = await request(app)
      .put(`/api/users/${target.id}/site`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ site_ids: [] });
    expect(res.status).toBe(403);
  });

  test('SUPERADMIN → 403 en PUT /api/users/:id/academic (datos académicos)', async () => {
    const target = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
    const res = await request(app)
      .put(`/api/users/${target.id}/academic`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ current_cycle: 4 });
    expect(res.status).toBe(403);
  });

  test('SUPERADMIN → 403 en POST /api/users/bulk/pdf (PDF de credenciales)', async () => {
    const org = await prisma.organization.findFirst();
    const res = await request(app)
      .post('/api/users/bulk/pdf')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        organization_id: org.id,
        users: [
          {
            email: 'pdfiso@x.com',
            firstName: 'X',
            lastName: 'Y',
          },
        ],
        temp_passwords: { 'pdfiso@x.com': PASSWORD },
      });
    expect(res.status).toBe(403);
  });

  test('SUPERADMIN → 403 en PATCH /api/users/:id/role (cambio de rol)', async () => {
    const target = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
    const res = await request(app)
      .patch(`/api/users/${target.id}/role`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ role: 'TEACHER' });
    expect(res.status).toBe(403);
  });

  test('SUPERADMIN → 403 en PUT /api/users/:id (edición)', async () => {
    const target = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
    const res = await request(app)
      .put(`/api/users/${target.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ first_name: 'Editado' });
    expect(res.status).toBe(403);
  });

  test('SUPERADMIN sí puede usar /api/users/admin/provision (es ruta PLATFORM)', async () => {
    const res = await request(app)
      .post('/api/users/admin/provision')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        organization: { name: 'X' },
        admin: { email: 'newadminprovision@x.com' },
      });
    // Si la validación del body falla (payload incompleto), será 400;
    // un éxito sería 201. NO debe ser 403 por "tenant access violation".
    expect([201, 400, 409]).toContain(res.status);
    expect(res.status).not.toBe(403);
  });

  test('ADMIN ORG → 200 en GET /api/users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminOrgToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
