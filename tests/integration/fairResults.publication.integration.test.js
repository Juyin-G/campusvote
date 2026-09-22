/**
 * FairResults — publicación oficial (ganador) y revisión de proyectos.
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

const PASSWORD = 'FairResultsPubTest123!';
const runId = Date.now();

const CLOSED2_P1 = '51000000-0000-4000-8000-000000000001';
const P2 = '11000000-0000-4000-8000-000000000004';
const JURY_A = '41000000-0000-4000-8000-000000000001';

let fairClosedId;
let fairOpenId;
let fairClosed2Id;
let adminAToken;
let studentToken;
let teacherToken;
let juryToken;

const login = async (email) => {
  const r = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  return r.body.data.token;
};

const createUser = async ({ role, organizationId, suffix, id } = {}) => {
  const base = {
    username: `frp.${role.toLowerCase()}.${suffix}.${runId}`,
    email: `frp.${role.toLowerCase()}.${suffix}.${runId}@campusvote.edu.pe`,
    password: await bcrypt.hash(PASSWORD, 12),
    firstName: 'Fair',
    lastName: role,
    institutionalId: `FRP${suffix}${runId}`,
    role,
    // chk_users_scope_admin_only: todo ADMIN tiene alcance; el resto, ninguno.
    scopeLevel: role === 'ADMIN' ? 'ORG' : null,
    authProvider: 'LOCAL',
    isVerified: true,
    status: 'ACTIVE',
    mustChangePassword: false,
    organizationId,
  };
  return id ? prisma.user.create({ data: { ...base, id } }) : prisma.user.create({ data: base });
};

const castAnonymousVote = ({ fairId, projectId }) =>
  prisma.fairVote.create({
    data: {
      fairId,
      projectId,
      receiptCode: `rc-${Math.random().toString(16).slice(2, 18)}`,
    },
  });

describe('FairResults — publicación oficial', () => {
  beforeAll(async () => {
    const orgA = await prisma.organization.create({ data: { name: `Org A Pub ${runId}`, code: `ORGAP${runId}` } });

    const adminA = await createUser({ role: 'ADMIN', organizationId: orgA.id, suffix: 'AdmA' });
    const student = await createUser({ role: 'STUDENT', organizationId: orgA.id, suffix: 'Std' });
    const teacher = await createUser({ role: 'TEACHER', organizationId: orgA.id, suffix: 'Tch' });
    const juryA = await createUser({ role: 'JURY', organizationId: orgA.id, suffix: 'JuryA', id: JURY_A });

    fairOpenId = (await prisma.fair.create({
      data: { organizationId: orgA.id, name: `Open ${runId}`, status: 'OPEN' },
    })).id;
    await prisma.fairJuryAssignment.create({
      data: { fairId: fairOpenId, userId: JURY_A, assignedById: adminA.id },
    });

    fairClosedId = (await prisma.fair.create({
      data: { organizationId: orgA.id, name: `Closed ${runId}`, status: 'OPEN' },
    })).id;
    await prisma.fairJuryAssignment.create({
      data: { fairId: fairClosedId, userId: JURY_A, assignedById: adminA.id },
    });
    await prisma.project.create({ data: { id: P2, fairId: fairClosedId, organizationId: orgA.id, createdById: student.id, name: 'Bravo', status: 'APPROVED', reviewedAt: new Date() } });
    await castAnonymousVote({ fairId: fairClosedId, projectId: P2 });
    await prisma.fair.update({ where: { id: fairClosedId }, data: { status: 'CLOSED' } });

    fairClosed2Id = (await prisma.fair.create({
      data: { organizationId: orgA.id, name: `Pub ${runId}`, status: 'OPEN' },
    })).id;
    await prisma.fairJuryAssignment.create({
      data: { fairId: fairClosed2Id, userId: JURY_A, assignedById: adminA.id },
    });
    await prisma.project.create({ data: { id: CLOSED2_P1, fairId: fairClosed2Id, organizationId: orgA.id, createdById: student.id, name: 'PubProj', status: 'APPROVED', reviewedAt: new Date() } });
    for (let i = 0; i < 2; i++) await castAnonymousVote({ fairId: fairClosed2Id, projectId: CLOSED2_P1 });
    await prisma.fair.update({ where: { id: fairClosed2Id }, data: { status: 'CLOSED' } });

    adminAToken = await login(adminA.email);
    studentToken = await login(student.email);
    teacherToken = await login(teacher.email);
    juryToken = await login(juryA.email);
  });

  afterAll(async () => prisma.$disconnect());

  const publishResults = (body) =>
    request(app).post(`/api/fairs/${fairClosed2Id}/results/publish`).set('Authorization', `Bearer ${adminAToken}`).send(body ?? {});

  const getResults = () =>
    request(app).get(`/api/fairs/${fairClosed2Id}/results`).set('Authorization', `Bearer ${adminAToken}`);

  it('antes de publicar → published=false', async () => {
    const res = await getResults();
    expect(res.status).toBe(200);
    expect(res.body.data.published).toBe(false);
  });

  it('PUBLICAR (ADMIN + CLOSED) → 201', async () => {
    const res = await publishResults({ ranking: [{ project_id: 'fake' }] });
    expect(res.status).toBe(201);
    expect(res.body.data.published).toBe(true);
  });

  it('publicar dos veces → 409', async () => {
    const res = await publishResults();
    expect(res.status).toBe(409);
  });

  it('tras publicar → winner=true solo posición 1', async () => {
    const res = await getResults();
    expect(res.body.data.published).toBe(true);
    expect(res.body.data.ranking[0].winner).toBe(true);
    expect(res.body.data.ranking.slice(1).every((e) => e.winner === false)).toBe(true);
  });

  it('PUBLICAR una feria OPEN → 409', async () => {
    const res = await request(app).post(`/api/fairs/${fairOpenId}/results/publish`).set('Authorization', `Bearer ${adminAToken}`);
    expect(res.status).toBe(409);
  });

  it('STUDENT/TEACHER no pueden publicar → 403', async () => {
    expect((await request(app).post(`/api/fairs/${fairClosedId}/results/publish`).set('Authorization', `Bearer ${studentToken}`)).status).toBe(403);
    expect((await request(app).post(`/api/fairs/${fairClosedId}/results/publish`).set('Authorization', `Bearer ${teacherToken}`)).status).toBe(403);
  });

  it('JURY no puede publicar → 403', async () => {
    expect((await request(app).post(`/api/fairs/${fairClosedId}/results/publish`).set('Authorization', `Bearer ${juryToken}`)).status).toBe(403);
  });
});
