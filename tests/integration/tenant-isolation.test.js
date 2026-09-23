import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Importaciones dinámicas para evitar errores de teardown en Jest ESM
const app = (await import('../../src/app.js')).default;
const { prisma } = await import('../../src/database/prisma.js');
const env = (await import('../../src/config/env.js')).default;

const JWT_SECRET = env.JWT_SECRET || 'test-secret-for-jest-only-do-not-use-in-prod';

const makeToken = (user) =>
  jwt.sign(
    { id: user.id, userId: user.id, email: user.email, role: user.role,
      organizationId: user.organizationId, scopeLevel: user.scopeLevel ?? null,
      isSuperuser: user.isSuperuser ?? false, isStaff: user.isStaff ?? false },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

describe('Multi-Tenant Isolation (FASE 15.4)', () => {
  let orgA, orgB, userAdminA, userAdminB, userSuperAdmin;
  let fairA, projectA, fairB, projectB;
  let tokenAdminA, tokenAdminB, tokenSuperAdmin;

  beforeAll(async () => {
    orgA = await prisma.organization.create({ data: { name: 'Org A', code: 'ORGA', orgType: 'UNIVERSITY' } });
    orgB = await prisma.organization.create({ data: { name: 'Org B', code: 'ORGB', orgType: 'UNIVERSITY' } });

    userAdminA = await prisma.user.create({ data: { username: 'adminA', email: 'admin@a.com', role: 'ADMIN', scopeLevel: 'ORG', organizationId: orgA.id, status: 'ACTIVE', authProvider: 'LOCAL', isVerified: true } });
    userAdminB = await prisma.user.create({ data: { username: 'adminB', email: 'admin@b.com', role: 'ADMIN', scopeLevel: 'ORG', organizationId: orgB.id, status: 'ACTIVE', authProvider: 'LOCAL', isVerified: true } });
    userSuperAdmin = await prisma.user.create({ data: { username: 'super', email: 'super@platform.com', role: 'SUPERADMIN', status: 'ACTIVE', authProvider: 'LOCAL', isVerified: true } });

    fairA = await prisma.fair.create({ data: { name: 'Feria A', organizationId: orgA.id, status: 'OPEN' } });
    projectA = await prisma.project.create({ data: { name: 'Proyecto A', fairId: fairA.id, organizationId: orgA.id, status: 'APPROVED', reviewedAt: new Date() } });
    
    fairB = await prisma.fair.create({ data: { name: 'Feria B', organizationId: orgB.id, status: 'OPEN' } });
    projectB = await prisma.project.create({ data: { name: 'Proyecto B', fairId: fairB.id, organizationId: orgB.id, status: 'APPROVED', reviewedAt: new Date() } });

    tokenAdminA = makeToken(userAdminA);
    tokenAdminB = makeToken(userAdminB);
    tokenSuperAdmin = makeToken(userSuperAdmin);
  });

  afterAll(async () => {
    await prisma.project.deleteMany({ where: { name: { contains: 'Proyecto' } } });
    await prisma.fair.deleteMany({ where: { name: { contains: 'Feria' } } });
    await prisma.user.deleteMany({ where: { username: { in: ['adminA', 'adminB', 'super'] } } });
    await prisma.organization.deleteMany({ where: { name: { contains: 'Org' } } });
    await prisma.$disconnect();
  });

  it('Admin de Org A NO puede dar like a proyecto de Org B (403)', async () => {
    const res = await request(app)
      .post(`/api/fairs/${fairB.id}/projects/${projectB.id}/like`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('Admin de Org A NO puede ver resultados de feria de Org B (403)', async () => {
    const res = await request(app)
      .get(`/api/fairs/${fairB.id}/results`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(res.status).toBe(403);
  });

  it('Admin de Org A NO puede crear notificacion para usuario de Org B (403)', async () => {
    const res = await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ user_id: userAdminB.id, title: 'Hack', body: 'Intento de fuga' });
    expect(res.status).toBe(403);
  });

  it('Admin de Org A NO puede completar onboarding de Org B (403)', async () => {
    const res = await request(app)
      .post(`/api/organizations/${orgB.id}/onboarding/complete`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(res.status).toBe(403);
  });

  it('Superadmin SI puede acceder a auditoria global de plataforma (200 o 404)', async () => {
    const res = await request(app)
      .get('/api/platform/audit/verify')
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect([200, 404]).toContain(res.status); 
  });

  it('Superadmin NO puede acceder a rutas de tenant (403 por boundary)', async () => {
    const res = await request(app)
      .get(`/api/fairs/${fairA.id}`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(res.status).toBe(403);
  });
});