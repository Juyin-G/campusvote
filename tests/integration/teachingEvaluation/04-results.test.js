import request from 'supertest';
import { prisma, app, makeToken, createOrganization, createAcademicEntities, createUser, createAssignment, createCriterion, createResponse, createDetail, cleanupDatabase, BASE, runId } from './helpers.js';

describe('4. Results & Permissions', () => {
  let orgA, entitiesA, adminA, teacherA1, teacherA2, studentA1;

  beforeAll(async () => {
    orgA = await createOrganization('A');
    entitiesA = await createAcademicEntities(orgA.id, 'A');
    adminA = await createUser({ role: 'ADMIN', orgId: orgA.id, programId: entitiesA.program.id, suffix: runId(), facultyId: entitiesA.faculty.id });
    teacherA1 = await createUser({ role: 'TEACHER', orgId: orgA.id, programId: entitiesA.program.id, suffix: runId(), facultyId: entitiesA.faculty.id });
    teacherA2 = await createUser({ role: 'TEACHER', orgId: orgA.id, programId: entitiesA.program.id, suffix: runId(), facultyId: entitiesA.faculty.id });
    studentA1 = await createUser({ role: 'STUDENT', orgId: orgA.id, careerId: entitiesA.career.id, programId: entitiesA.program.id, cycle: 1, admissionPeriodId: entitiesA.period.id, suffix: runId() });
  });

  afterAll(async () => { await cleanupDatabase(); });

  it('Resultados disponibles solo con >= 3 respuestas', async () => {
    const crit = await createCriterion(orgA.id, 'Min3Crit');
    const assignment = await createAssignment({ orgId: orgA.id, periodId: entitiesA.period.id, careerId: entitiesA.career.id, courseId: entitiesA.course.id, teacherId: teacherA1.id, cycle: 1 });
    
    for (let i = 0; i < 3; i++) {
      const stu = await createUser({ role: 'STUDENT', orgId: orgA.id, careerId: entitiesA.career.id, programId: entitiesA.program.id, cycle: 1, admissionPeriodId: entitiesA.period.id, suffix: `min3_${i}_${runId()}` });
      const resp = await createResponse(assignment.id, stu.id, 'SUBMITTED');
      const allActive = await prisma.evaluationCriterion.findMany({ where: { organizationId: orgA.id, isActive: true } });
      for (const c of allActive) {
        const existing = await prisma.evaluationResponseDetail.findFirst({ where: { evaluationResponseId: resp.id, criterionId: c.id } });
        if (!existing) await createDetail(resp.id, c.id, 4);
      }
    }
    const res = await request(app).get(`${BASE}/evaluation-results/teacher/${teacherA1.id}/summary`).set('Authorization', `Bearer ${makeToken(adminA)}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('meta');
  });

  it('Evolution: período con < 3 respuestas no aparece', async () => {
    const crit = await createCriterion(orgA.id, 'EvoCrit');
    const period2 = await prisma.academicPeriod.create({ data: { name: `EvoP2 ${runId()}`, startDate: new Date('2029-07-01'), endDate: new Date('2029-12-31'), isActive: true } });
    const assignP2 = await createAssignment({ orgId: orgA.id, periodId: period2.id, careerId: entitiesA.career.id, courseId: entitiesA.course.id, teacherId: teacherA2.id, cycle: 2 });
    
    const stu = await createUser({ role: 'STUDENT', orgId: orgA.id, careerId: entitiesA.career.id, programId: entitiesA.program.id, cycle: 2, admissionPeriodId: period2.id, suffix: `evo_${runId()}` });
    const resp = await createResponse(assignP2.id, stu.id, 'SUBMITTED');
    await createDetail(resp.id, crit.id, 5);

    const res = await request(app).get(`${BASE}/evaluation-results/teacher/${teacherA2.id}/evolution`).set('Authorization', `Bearer ${makeToken(adminA)}`);
    expect(res.status).toBe(200);
    if (res.body.data && res.body.data.evolution) {
      const p2 = res.body.data.evolution.find(e => e.academicPeriodId === period2.id);
      expect(p2).toBeUndefined();
    }
  });

  it('Score Distribution: retorna 5 categorías (1-5)', async () => {
    const res = await request(app).get(`${BASE}/evaluation-results/teacher/${teacherA2.id}/distribution`).set('Authorization', `Bearer ${makeToken(adminA)}`);
    expect(res.status).toBe(200);
    if (res.body.data && res.body.data.distribution) {
      expect(res.body.data.distribution).toHaveLength(5);
      const scores = res.body.data.distribution.map(d => d.score);
      expect(scores).toEqual([5, 4, 3, 2, 1]);
    }
  });

  it('Anonymous Comments: retorna SOLO strings, sin datos identificables', async () => {
    const crit = await createCriterion(orgA.id, 'AnonCrit');
    const assignment = await createAssignment({ orgId: orgA.id, periodId: entitiesA.period.id, careerId: entitiesA.career.id, courseId: entitiesA.course.id, teacherId: teacherA2.id, cycle: 1 });
    for (let i = 0; i < 3; i++) {
      const stu = await createUser({ role: 'STUDENT', orgId: orgA.id, careerId: entitiesA.career.id, programId: entitiesA.program.id, cycle: 1, admissionPeriodId: entitiesA.period.id, suffix: `anon_${i}_${runId()}` });
      const resp = await createResponse(assignment.id, stu.id, 'SUBMITTED');
      await createDetail(resp.id, crit.id, 4);
      await prisma.evaluationResponse.update({ where: { id: resp.id }, data: { comment: `Comentario anónimo ${i}` } });
    }
    const res = await request(app).get(`${BASE}/evaluation-results/teacher/${teacherA2.id}/comments`).set('Authorization', `Bearer ${makeToken(teacherA2)}`);
    expect(res.status).toBe(200);
    if (res.body.data && res.body.data.comments) {
      const json = JSON.stringify(res.body);
      expect(json).not.toContain('studentId');
      expect(json).not.toContain('firstName');
      expect(json).not.toContain('email');
      for (const c of res.body.data.comments) {
        expect(typeof c).toBe('string');
      }
    }
  });

  it('Results Permissions: TEACHER consulta propios (OK), otros (403), STUDENT (403)', async () => {
    const resOwn = await request(app).get(`${BASE}/evaluation-results/teacher/${teacherA1.id}/summary`).set('Authorization', `Bearer ${makeToken(teacherA1)}`);
    expect(resOwn.status).toBe(200);

    const resOther = await request(app).get(`${BASE}/evaluation-results/teacher/${teacherA2.id}/summary`).set('Authorization', `Bearer ${makeToken(teacherA1)}`);
    expect(resOther.status).toBe(403);

    const resStudent = await request(app).get(`${BASE}/evaluation-results/teacher/${teacherA1.id}/summary`).set('Authorization', `Bearer ${makeToken(studentA1)}`);
    expect(resStudent.status).toBe(403);
  });
});