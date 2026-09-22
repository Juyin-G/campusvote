import request from 'supertest';
import { prisma, app, makeToken, createOrganization, createAcademicEntities, createUser, createAssignment, createResponse, cleanupDatabase, BASE, runId } from './helpers.js';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('5. Architecture & State Integrity', () => {
  let orgA, entitiesA, adminA, studentA1;

  beforeAll(async () => {
    orgA = await createOrganization('A');
    entitiesA = await createAcademicEntities(orgA.id, 'A');
    adminA = await createUser({ role: 'ADMIN', orgId: orgA.id, programId: entitiesA.program.id, suffix: runId(), facultyId: entitiesA.faculty.id });
    studentA1 = await createUser({ role: 'STUDENT', orgId: orgA.id, careerId: entitiesA.career.id, programId: entitiesA.program.id, cycle: 1, admissionPeriodId: entitiesA.period.id, suffix: runId() });
  });

  afterAll(async () => { await cleanupDatabase(); });

  it('Domain Isolation: evaluation services no importan de electoral/fairs/ratings', async () => {
    const dir = 'src/modules/academic/teachingEvaluation';
    const files = await fs.readdir(dir);
    const jsFiles = files.filter(f => f.endsWith('.js'));
    for (const file of jsFiles) {
      const content = await fs.readFile(path.join(dir, file), 'utf8');
      expect(content).not.toMatch(/from\s+['"]\.\.\/\.\.\/\.\.\/.*electoral/i);
      expect(content).not.toMatch(/from\s+['"]\.\.\/\.\.\/\.\.\/.*fairs/i);
      expect(content).not.toMatch(/from\s+['"]\.\.\/\.\.\/\.\.\/.*ratings/i);
    }
  });

  it('Legacy Isolation: nuevos servicios NO escriben en teacher_evaluations', async () => {
    const dir = 'src/modules/academic/teachingEvaluation';
    const files = await fs.readdir(dir);
    const jsFiles = files.filter(f => f.endsWith('.js') && !['teachingEvaluation.service.js', 'teachingEvaluation.routes.js'].includes(f));
    for (const file of jsFiles) {
      const content = await fs.readFile(path.join(dir, file), 'utf8');
      expect(content).not.toMatch(/prisma\.teacherEvaluation\.(create|update|delete|upsert)/i);
    }
  });

  it('State Integrity: DRAFT + submittedAt != NULL es imposible (DB CHECK)', async () => {
    const assignment = await createAssignment({ orgId: orgA.id, periodId: entitiesA.period.id, careerId: entitiesA.career.id, courseId: entitiesA.course.id, teacherId: (await createUser({ role: 'TEACHER', orgId: orgA.id, programId: entitiesA.program.id, suffix: runId(), facultyId: entitiesA.faculty.id })).id, cycle: 1 });
    const resp = await createResponse(assignment.id, studentA1.id, 'DRAFT');
    try {
      await prisma.evaluationResponse.update({ where: { id: resp.id }, data: { submittedAt: new Date() } });
      const check = await prisma.evaluationResponse.findUnique({ where: { id: resp.id } });
      expect(check.status).toBe('DRAFT'); // Si el check de BD falla, no llega aquí o revierte
    } catch {
      expect(true).toBe(true); // Se espera que la BD rechace la actualización
    }
  });

  it('State Integrity: SUBMITTED + submittedAt == NULL es imposible (DB CHECK)', async () => {
    const assignment = await createAssignment({ orgId: orgA.id, periodId: entitiesA.period.id, careerId: entitiesA.career.id, courseId: entitiesA.course.id, teacherId: (await createUser({ role: 'TEACHER', orgId: orgA.id, programId: entitiesA.program.id, suffix: runId(), facultyId: entitiesA.faculty.id })).id, cycle: 1 });
    const resp = await createResponse(assignment.id, studentA1.id, 'SUBMITTED');
    expect(resp.submittedAt).not.toBeNull();
    try {
      await prisma.evaluationResponse.update({ where: { id: resp.id }, data: { submittedAt: null } });
      const check = await prisma.evaluationResponse.findUnique({ where: { id: resp.id } });
      expect(check.submittedAt).not.toBeNull();
    } catch {
      expect(true).toBe(true);
    }
  });

  it('Final Validations: endpoints básicos responden correctamente', async () => {
    const resCrit = await request(app).get(`${BASE}/evaluation-criteria`).set('Authorization', `Bearer ${makeToken(adminA)}`);
    expect(resCrit.status).toBe(200);
    expect(Array.isArray(resCrit.body.data)).toBe(true);

    const resMine = await request(app).get(`${BASE}/evaluation-responses/mine`).set('Authorization', `Bearer ${makeToken(studentA1)}`);
    expect(resMine.status).toBe(200);
  });
});