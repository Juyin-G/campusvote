/**
 * FairResults — pruebas de integración HTTP + BD (modelo VOTOS).
 * Cubre: autorización, ranking derivado y publicación.
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

const P1 = '10000000-0000-4000-8000-000000000001';
const P4 = '10000000-0000-4000-8000-000000000002';
const P5 = '10000000-0000-4000-8000-000000000003';
const P2 = '10000000-0000-4000-8000-000000000004';
const P3 = '10000000-0000-4000-8000-000000000005';
const CLOSED2_P1 = '50000000-0000-4000-8000-000000000001';

const JURY_A = '40000000-0000-4000-8000-000000000001';

let fairClosedId;
let fairForeignId;
let fairClosed2Id;
let adminAToken;
let adminBToken;
let superToken;
let studentToken;
let teacherToken;
let juryToken;

const login = async (email) => {
  const r = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  return r.body.data.token;
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
  };
  return id ? prisma.user.create({ data: { ...base, id } }) : prisma.user.create({ data: base });
};

const createProject = async ({ id, fairId, organizationId, createdById, name, status }) =>
  prisma.project.create({ data: { id, fairId, organizationId, createdById, name, status, description: null } });

const castAnonymousVote = ({ fairId, projectId }) =>
  prisma.fairVote.create({
    data: {
      fairId,
      projectId,
      receiptCode: `rc-${Math.random().toString(16).slice(2, 18)}`,
    },
  });

const getResults = (token, fairId) =>
  request(app).get(`/api/fairs/${fairId}/results`).set('Authorization', `Bearer ${token}`);

describe('FairResults Integration — autorización + ranking + publicación', () => {
  beforeAll(async () => {
    const orgA = await prisma.organization.create({ data: { name: `Org A ${runId}`, code: `ORGA${runId}` } });
    const orgB = await prisma.organization.create({ data: { name: `Org B ${runId}`, code: `ORGB${runId}` } });

    const adminA = await createUser({ role: 'ADMIN', organizationId: orgA.id, suffix: 'AdmA' });
    const adminB = await createUser({ role: 'ADMIN', organizationId: orgB.id, suffix: 'AdmB' });
    const sup = await createUser({ role: 'SUPERADMIN', organizationId: null, suffix: 'Sup' });
    const student = await createUser({ role: 'STUDENT', organizationId: orgA.id, suffix: 'Std' });
    const teacher = await createUser({ role: 'TEACHER', organizationId: orgA.id, suffix: 'Tch' });
    const juryA = await createUser({ role: 'JURY', organizationId: orgA.id, suffix: 'JuryA', id: JURY_A });

    fairClosedId = (await prisma.fair.create({
      data: { organizationId: orgA.id, name: `Feria Cerrada ${runId}`, status: 'OPEN' },
    })).id;
    await prisma.fairJuryAssignment.create({
      data: { fairId: fairClosedId, userId: JURY_A, assignedById: adminA.id },
    });
    await createProject({ id: P1, fairId: fairClosedId, organizationId: orgA.id, createdById: student.id, name: 'Alpha', status: 'APPROVED' });
    await createProject({ id: P4, fairId: fairClosedId, organizationId: orgA.id, createdById: student.id, name: 'Delta', status: 'APPROVED' });
    await createProject({ id: P5, fairId: fairClosedId, organizationId: orgA.id, createdById: student.id, name: 'Echo', status: 'APPROVED' });
    await createProject({ id: P2, fairId: fairClosedId, organizationId: orgA.id, createdById: student.id, name: 'Bravo', status: 'APPROVED' });
    await createProject({ id: P3, fairId: fairClosedId, organizationId: orgA.id, createdById: student.id, name: 'SinVoto', status: 'APPROVED' });
    for (let i = 0; i < 4; i++) castAnonymousVote({ fairId: fairClosedId, projectId: P2 });
    for (let i = 0; i < 3; i++) castAnonymousVote({ fairId: fairClosedId, projectId: P1 });
    for (let i = 0; i < 3; i++) castAnonymousVote({ fairId: fairClosedId, projectId: P4 });
    for (let i = 0; i < 3; i++) castAnonymousVote({ fairId: fairClosedId, projectId: P5 });
    await prisma.fair.update({ where: { id: fairClosedId }, data: { status: 'CLOSED' } });

    fairForeignId = (await prisma.fair.create({
      data: { organizationId: orgB.id, name: `Feria Extraña ${runId}`, status: 'OPEN' },
    })).id;
    const juryB = await createUser({ role: 'JURY', organizationId: orgB.id, suffix: 'JuryB' });
    await prisma.fairJuryAssignment.create({
      data: { fairId: fairForeignId, userId: juryB.id, assignedById: adminB.id },
    });
    await createProject({ id: '30000000-0000-4000-8000-000000000001', fairId: fairForeignId, organizationId: orgB.id, createdById: adminB.id, name: 'Extranjero', status: 'APPROVED' });
    castAnonymousVote({ fairId: fairForeignId, projectId: '30000000-0000-4000-8000-000000000001' });
    await prisma.fair.update({ where: { id: fairForeignId }, data: { status: 'CLOSED' } });

    fairClosed2Id = (await prisma.fair.create({
      data: { organizationId: orgA.id, name: `Feria a Publicar ${runId}`, status: 'OPEN' },
    })).id;
    await prisma.fairJuryAssignment.create({
      data: { fairId: fairClosed2Id, userId: JURY_A, assignedById: adminA.id },
    });
    await createProject({ id: CLOSED2_P1, fairId: fairClosed2Id, organizationId: orgA.id, createdById: student.id, name: 'Publicado', status: 'APPROVED' });
    for (let i = 0; i < 2; i++) castAnonymousVote({ fairId: fairClosed2Id, projectId: CLOSED2_P1 });
    await prisma.fair.update({ where: { id: fairClosed2Id }, data: { status: 'CLOSED' } });

    adminAToken = await login(adminA.email);
    adminBToken = await login(adminB.email);
    superToken = await login(sup.email);
    studentToken = await login(student.email);
    teacherToken = await login(teacher.email);
    juryToken = await login(juryA.email);
  });

  afterAll(async () => prisma.$disconnect());

  describe('Autorización', () => {
    it('feria inexistente → 404', async () => {
      const res = await getResults(adminAToken, '99999999-9999-4999-8999-999999999999');
      expect(res.status).toBe(404);
    });
    it('ADMIN de otra org → 403', async () => {
      const res = await getResults(adminAToken, fairForeignId);
      expect(res.status).toBe(403);
    });
    it('STUDENT/TEACHER → 403', async () => {
      expect((await getResults(studentToken, fairClosedId)).status).toBe(403);
      expect((await getResults(teacherToken, fairClosedId)).status).toBe(403);
    });
    it('JURY → 403', async () => {
      expect((await getResults(juryToken, fairClosedId)).status).toBe(403);
    });
  });

  describe('Ranking derivado de VOTOS', () => {
    it('Bravo (P2) con 4 votos gana la posición 1', async () => {
      const res = await getResults(adminAToken, fairClosedId);
      expect(res.body.data.ranking[0].project_id).toBe(P2);
      expect(res.body.data.ranking[0].position).toBe(1);
      expect(res.body.data.ranking[0].votes).toBe(4);
    });
    it('empate de votos → id ASC (P1 antes que P4)', async () => {
      const res = await getResults(adminAToken, fairClosedId);
      const ranking = res.body.data.ranking;
      const idxP1 = ranking.findIndex((e) => e.project_id === P1);
      const idxP4 = ranking.findIndex((e) => e.project_id === P4);
      expect(idxP1).toBeGreaterThan(-1);
      expect(idxP4).toBe(idxP1 + 1);
    });
    it('proyecto sin votos → votes=0, position=null', async () => {
      const res = await getResults(adminAToken, fairClosedId);
      const p3 = res.body.data.ranking.find((e) => e.project_id === P3);
      expect(p3.votes).toBe(0);
      expect(p3.position).toBeNull();
      expect(p3.winner).toBe(false);
    });
    it('winner=false en CLOSED SIN publicar', async () => {
      const res = await getResults(adminAToken, fairClosedId);
      expect(res.body.data.published).toBe(false);
      expect(res.body.data.ranking.every((e) => e.winner === false)).toBe(true);
    });
  });
});
