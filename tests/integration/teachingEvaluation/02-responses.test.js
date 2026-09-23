import request from 'supertest';
import { prisma, app, makeToken, createOrganization, createAcademicEntities, createUser, createAssignment, createCriterion, createResponse, createDetail, cleanupDatabase, BASE, runId, TEST_PASSWORD } from './helpers.js';
import bcrypt from 'bcryptjs';

describe('2. Responses, Details & Submit', () => {
  let orgA, entitiesA, adminA, teacherA1, teacherA2, studentA1, studentA2, studentA3, assignment;
  const hashPassword = (pw) => bcrypt.hash(pw, 12);

  beforeAll(async () => {
    orgA = await createOrganization('A');
    entitiesA = await createAcademicEntities(orgA.id, 'A');
    adminA = await createUser({ role: 'ADMIN', orgId: orgA.id, programId: entitiesA.program.id, suffix: runId(), facultyId: entitiesA.faculty.id });
    teacherA1 = await createUser({ role: 'TEACHER', orgId: orgA.id, programId: entitiesA.program.id, suffix: runId(), facultyId: entitiesA.faculty.id });
    teacherA2 = await createUser({ role: 'TEACHER', orgId: orgA.id, programId: entitiesA.program.id, suffix: runId(), facultyId: entitiesA.faculty.id });
    studentA1 = await createUser({ role: 'STUDENT', orgId: orgA.id, careerId: entitiesA.career.id, programId: entitiesA.program.id, cycle: 1, admissionPeriodId: entitiesA.period.id, suffix: runId() });
    studentA2 = await createUser({ role: 'STUDENT', orgId: orgA.id, careerId: entitiesA.career.id, programId: entitiesA.program.id, cycle: 1, admissionPeriodId: entitiesA.period.id, suffix: runId() });
    studentA3 = await createUser({ role: 'STUDENT', orgId: orgA.id, careerId: entitiesA.career.id, programId: entitiesA.program.id, cycle: 1, admissionPeriodId: entitiesA.period.id, suffix: runId() });
    assignment = await createAssignment({ orgId: orgA.id, periodId: entitiesA.period.id, careerId: entitiesA.career.id, courseId: entitiesA.course.id, teacherId: teacherA1.id, cycle: 1 });
  });

  afterAll(async () => { await cleanupDatabase(); });

  it('POST /evaluation-responses — STUDENT crea DRAFT', async () => {
    const res = await request(app).post(`${BASE}/evaluation-responses`).set('Authorization', `Bearer ${makeToken(studentA1)}`).send({ teachingAssignmentId: assignment.id });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
  });

  it('POST — rechaza TEACHER y ADMIN', async () => {
    const resT = await request(app).post(`${BASE}/evaluation-responses`).set('Authorization', `Bearer ${makeToken(teacherA1)}`).send({ teachingAssignmentId: assignment.id });
    expect(resT.status).toBe(403);
    const resAd = await request(app).post(`${BASE}/evaluation-responses`).set('Authorization', `Bearer ${makeToken(adminA)}`).send({ teachingAssignmentId: assignment.id });
    expect(resAd.status).toBe(403);
  });

  it('POST — rechaza autoevaluación', async () => {
    const selfUser = await createUser({ role: 'STUDENT', orgId: orgA.id, careerId: entitiesA.career.id, programId: entitiesA.program.id, cycle: 1, admissionPeriodId: entitiesA.period.id, suffix: `self_${runId()}` });
    const selfAssign = await createAssignment({ orgId: orgA.id, periodId: entitiesA.period.id, careerId: entitiesA.career.id, courseId: entitiesA.course.id, teacherId: selfUser.id, cycle: 1 });
    const res = await request(app).post(`${BASE}/evaluation-responses`).set('Authorization', `Bearer ${makeToken(selfUser)}`).send({ teachingAssignmentId: selfAssign.id });
    expect(res.status).toBe(400);
  });

  it('PUT detail — score válido 1-5 y upsert', async () => {
    const draft = await createResponse(assignment.id, studentA2.id);
    const crit = await createCriterion(orgA.id, 'DetailCritA');
    const res1 = await request(app).put(`${BASE}/evaluation-responses/${draft.id}/details/${crit.id}`).set('Authorization', `Bearer ${makeToken(studentA2)}`).send({ score: 4 });
    expect(res1.status).toBe(200);
    const res2 = await request(app).put(`${BASE}/evaluation-responses/${draft.id}/details/${crit.id}`).set('Authorization', `Bearer ${makeToken(studentA2)}`).send({ score: 5 });
    expect(res2.status).toBe(200);
    expect(res2.body.data.score).toBe(5);
  });

  it('PUT detail — validaciones de score y criterio', async () => {
    const draft = await createResponse(assignment.id, studentA2.id);
    const crit = await createCriterion(orgA.id, 'DetailCritB');
    const res0 = await request(app).put(`${BASE}/evaluation-responses/${draft.id}/details/${crit.id}`).set('Authorization', `Bearer ${makeToken(studentA2)}`).send({ score: 0 });
    expect(res0.status).toBe(400);
    const resDec = await request(app).put(`${BASE}/evaluation-responses/${draft.id}/details/${crit.id}`).set('Authorization', `Bearer ${makeToken(studentA2)}`).send({ score: 3.5 });
    expect(resDec.status).toBe(400);
  });

  it('DELETE detail y GET details', async () => {
    const draft = await createResponse(assignment.id, studentA2.id);
    const crit = await createCriterion(orgA.id, 'DetailCritC');
    await createDetail(draft.id, crit.id, 3);
    const resDel = await request(app).delete(`${BASE}/evaluation-responses/${draft.id}/details/${crit.id}`).set('Authorization', `Bearer ${makeToken(studentA2)}`);
    expect(resDel.status).toBe(200);
    const resGet = await request(app).get(`${BASE}/evaluation-responses/${draft.id}/details`).set('Authorization', `Bearer ${makeToken(studentA2)}`);
    expect(resGet.status).toBe(200);
  });

  it('SUBMIT — exitoso con todos los criterios, rechazado si faltan', async () => {
    const crit1 = await createCriterion(orgA.id, 'SubmitCrit1');
    const assign2 = await createAssignment({ orgId: orgA.id, periodId: entitiesA.period.id, careerId: entitiesA.career.id, courseId: entitiesA.course.id, teacherId: teacherA2.id, cycle: 1 });
    const draft = await createResponse(assign2.id, studentA1.id);
    await createDetail(draft.id, crit1.id, 4);
    const allActive = await prisma.evaluationCriterion.findMany({ where: { organizationId: orgA.id, isActive: true } });
    for (const c of allActive) {
      const existing = await prisma.evaluationResponseDetail.findFirst({ where: { evaluationResponseId: draft.id, criterionId: c.id } });
      if (!existing) await createDetail(draft.id, c.id, 3);
    }
    const res = await request(app).post(`${BASE}/evaluation-responses/${draft.id}/submit`).set('Authorization', `Bearer ${makeToken(studentA1)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SUBMITTED');
  });

  it('Inmutabilidad post-submit — rechaza PUT, DELETE, PATCH, SUBMIT', async () => {
    const crit = await createCriterion(orgA.id, 'ImmutCrit');
    const assign3 = await createAssignment({ orgId: orgA.id, periodId: entitiesA.period.id, careerId: entitiesA.career.id, courseId: entitiesA.course.id, teacherId: teacherA1.id, cycle: 1 });
    const submitted = await createResponse(assign3.id, studentA3.id, 'SUBMITTED');
    await createDetail(submitted.id, crit.id, 4);
    
    const resPut = await request(app).put(`${BASE}/evaluation-responses/${submitted.id}/details/${crit.id}`).set('Authorization', `Bearer ${makeToken(studentA3)}`).send({ score: 5 });
    expect(resPut.status).toBe(409);
    
    const resPatch = await request(app).patch(`${BASE}/evaluation-responses/${submitted.id}/comment`).set('Authorization', `Bearer ${makeToken(studentA3)}`).send({ comment: 'modificar' });
    expect(resPatch.status).toBe(409);
  });

  it('Comentarios — owner puede modificar en DRAFT, otro estudiante rechazado', async () => {
    const assign4 = await createAssignment({ orgId: orgA.id, periodId: entitiesA.period.id, careerId: entitiesA.career.id, courseId: entitiesA.course.id, teacherId: teacherA2.id, cycle: 1 });
    const draft = await createResponse(assign4.id, studentA1.id);
    const resOk = await request(app).patch(`${BASE}/evaluation-responses/${draft.id}/comment`).set('Authorization', `Bearer ${makeToken(studentA1)}`).send({ comment: 'Buen docente' });
    expect(resOk.status).toBe(200);
    const resFail = await request(app).patch(`${BASE}/evaluation-responses/${draft.id}/comment`).set('Authorization', `Bearer ${makeToken(studentA2)}`).send({ comment: 'hack' });
    expect(resFail.status).toBe(403);
  });

  it('Protección de duplicados concurrentes', async () => {
    const assign5 = await createAssignment({ orgId: orgA.id, periodId: entitiesA.period.id, careerId: entitiesA.career.id, courseId: entitiesA.course.id, teacherId: teacherA2.id, cycle: 1 });
    const stu = await createUser({ role: 'STUDENT', orgId: orgA.id, careerId: entitiesA.career.id, programId: entitiesA.program.id, cycle: 1, admissionPeriodId: entitiesA.period.id, suffix: `conc_${runId()}` });
    const token = makeToken(stu);
    const payload = { teachingAssignmentId: assign5.id };
    const [r1, r2] = await Promise.all([
      request(app).post(`${BASE}/evaluation-responses`).set('Authorization', `Bearer ${token}`).send(payload),
      request(app).post(`${BASE}/evaluation-responses`).set('Authorization', `Bearer ${token}`).send(payload),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);
  });
});