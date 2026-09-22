import { jest } from '@jest/globals';
import request from 'supertest'; // ✅ Importación por defecto (sin llaves)
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

// Mocks de servicios externos (Rutas corregidas a 3 niveles: ../../../)
jest.unstable_mockModule('../../../src/shared/services/email.service.js', () => {
  const noop = jest.fn().mockResolvedValue(true);
  return {
    hasEmailConfigured: jest.fn().mockReturnValue(false),
    sendVerification: noop, 
    sendReset: noop, 
    sendActivation: noop,
    sendAdminActivation: noop, 
    sendRequestReceived: noop,
    default: { 
      hasEmailConfigured: jest.fn().mockReturnValue(false), 
      sendVerification: noop, 
      sendReset: noop, 
      sendActivation: noop, 
      sendAdminActivation: noop, 
      sendRequestReceived: noop 
    },
  };
});

jest.unstable_mockModule('../../../src/middlewares/rateLimiter.middleware.js', () => ({
  loginLimiter: (_r, _s, n) => n(), 
  authLimiter: (_r, _s, n) => n(),
  userLimiter: () => (_r, _s, n) => n(), 
}));

// Importaciones dinámicas para evitar errores de teardown en Jest ESM
const appModule = await import('../../../src/app.js');
export const app = appModule.default || appModule;

const prismaModule = await import('../../../src/database/prisma.js');
export const prisma = prismaModule.prisma || prismaModule.default;

const envModule = await import('../../../src/config/env.js');
export const env = envModule.default || envModule;

export const JWT_SECRET = env.JWT_SECRET || 'test-secret-for-jest-only-do-not-use-in-prod';
export const BASE = '/api/academic';
export const TEST_PASSWORD = 'Phase5Test!2026';

export const runId = () => Date.now() + Math.random().toString(36).slice(2, 6);

export const makeToken = (user) =>
  jwt.sign(
    { id: user.id, userId: user.id, email: user.email, role: user.role,
      organizationId: user.organizationId, isSuperuser: user.isSuperuser ?? false,
      isStaff: user.isStaff ?? false, scopeLevel: user.scopeLevel ?? null,
      regionId: user.regionId ?? null },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

export const createOrganization = async (suffix) => {
  const code = `ORG${suffix}${runId()}`.slice(0, 30);
  return prisma.organization.create({
    data: { name: `Org Test ${suffix} ${runId()}`.slice(0, 200), code, orgType: 'UNIVERSITY' },
  });
};

export const createAcademicEntities = async (orgId, suffix) => {
  const faculty = await prisma.faculty.create({ data: { name: `Fac ${suffix} ${runId()}`.slice(0, 149), code: `FC${suffix}${runId()}`.slice(0, 20) } });
  const program = await prisma.program.create({ data: { facultyId: faculty.id, name: `Prog ${suffix} ${runId()}`.slice(0, 149), code: `PR${suffix}${runId()}`.slice(0, 20) } });
  const startYear = suffix === 'A' ? 2026 : 2027;
  const period = await prisma.academicPeriod.create({ data: { name: `Period ${suffix} ${runId()}`, startDate: new Date(`${startYear}-01-01`), endDate: new Date(`${startYear}-06-30`), isActive: true } });
  const career = await prisma.career.create({ data: { organizationId: orgId, code: `CR${suffix}${runId()}`.slice(0, 20), name: `Carrera ${suffix}`, cycle: 10, isActive: true } });
  const careerB = await prisma.career.create({ data: { organizationId: orgId, code: `CRB${suffix}${runId()}`.slice(0, 20), name: `Carrera B ${suffix}`, cycle: 10, isActive: true } });
  const course = await prisma.course.create({ data: { organizationId: orgId, careerId: career.id, code: `CO${suffix}${runId()}`.slice(0, 30), name: `Curso ${suffix}`, cycle: 1, isActive: true } });
  const courseB = await prisma.course.create({ data: { organizationId: orgId, careerId: careerB.id, code: `COB${suffix}${runId()}`.slice(0, 30), name: `Curso B ${suffix}`, cycle: 1, isActive: true } });
  return { faculty, program, period, career, careerB, course, courseB };
};

const hashPassword = (pw) => bcrypt.hash(pw, 12);

export const createUser = async ({ role, orgId, careerId, programId, cycle, admissionPeriodId, suffix, facultyId }) => {
  const h = await hashPassword(TEST_PASSWORD);
  const id = `usr-${role.toLowerCase()}-${suffix}-${runId()}`;
  const emailDomain = (role === 'STUDENT' || role === 'TEACHER') ? '@campusvote.edu.pe' : '@admin.edu.pe';
  return prisma.user.create({
    data: {
      username: `user_${id}`, email: `${id}${emailDomain}`, password: h,
      firstName: `First${suffix}`, lastName: `Last${suffix}`,
      institutionalId: `IID${id}`, role, authProvider: 'LOCAL',
      isVerified: true, status: 'ACTIVE', mustChangePassword: false,
      organizationId: orgId, programId, careerId,
      facultyId: role === 'TEACHER' ? facultyId : undefined,
      currentCycle: cycle ?? null, admissionPeriodId: admissionPeriodId ?? null,
      scopeLevel: role === 'ADMIN' ? 'ORG' : undefined,
    },
  });
};

let assignmentCounter = 0;
export const createAssignment = async ({ orgId, periodId, careerId, courseId, teacherId, cycle }) => {
  assignmentCounter += 1;
  const uniqueCourse = await prisma.course.create({
    data: { organizationId: orgId, careerId, code: `ASGN${assignmentCounter}${runId()}`.slice(0, 30), name: `Assignment Course ${assignmentCounter}`, cycle: cycle ?? 1, isActive: true },
  });
  return prisma.teachingAssignment.create({
    data: { organizationId: orgId, academicPeriodId: periodId, careerId, courseId: uniqueCourse.id, teacherId, cycle: cycle ?? 1, isActive: true },
  });
};

export const createCriterion = async (orgId, name, active = true) =>
  prisma.evaluationCriterion.create({ data: { organizationId: orgId, name, description: `${name} desc`, isActive: active } });

export const createResponse = async (assignmentId, studentId, status = 'DRAFT') =>
  prisma.evaluationResponse.create({ data: { teachingAssignmentId: assignmentId, studentId, status, submittedAt: status === 'SUBMITTED' ? new Date() : null } });

export const createDetail = async (responseId, criterionId, score) =>
  prisma.evaluationResponseDetail.create({ data: { evaluationResponseId: responseId, criterionId, score } });

export const cleanupDatabase = async () => {
  const safe = (fn) => fn().catch(() => {});
  await safe(() => prisma.evaluationResponseDetail.deleteMany({}));
  await safe(() => prisma.evaluationResponse.deleteMany({}));
  await safe(() => prisma.evaluationCriterion.deleteMany({}));
  await safe(() => prisma.teachingAssignment.deleteMany({}));
  await safe(() => prisma.course.deleteMany({}));
  await safe(() => prisma.career.deleteMany({}));
  await safe(() => prisma.academicPeriod.deleteMany({}));
  await safe(() => prisma.program.deleteMany({}));
  await safe(() => prisma.user.deleteMany({ where: { email: { contains: '@campusvote.edu.pe' } } }));
  await safe(() => prisma.user.deleteMany({ where: { email: { contains: '@admin.edu.pe' } } }));
  await safe(() => prisma.faculty.deleteMany({}));
  await safe(() => prisma.organization.deleteMany({ where: { name: { contains: 'Org Test' } } }));
};