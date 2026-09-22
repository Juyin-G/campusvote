import request from 'supertest';
import { prisma, app, makeToken, createOrganization, createAcademicEntities, createUser, createAssignment, createCriterion, createResponse, createDetail, cleanupDatabase, BASE, runId } from './helpers.js';

describe('3. Isolation (Career, Cycle, Period, Ownership, Org)', () => {
  let orgA, orgB, entitiesA, entitiesB, adminA, adminB, teacherA1, teacherA2, teacherB1, studentA1, studentB1;

  beforeAll(async () => {
    orgA = await createOrganization('A');
    entitiesA = await createAcademicEntities(orgA.id, 'A');
    adminA = await createUser({ role: 'ADMIN', orgId: orgA.id, programId: entitiesA.program.id, suffix: runId(), facultyId: entitiesA.faculty.id });
    teacherA1 = await createUser({ role: 'TEACHER', orgId: orgA.id, programId: entitiesA.program.id, suffix: runId(), facultyId: entitiesA.faculty.id });
    teacherA2 = await createUser({ role: 'TEACHER', orgId: orgA.id, programId: entitiesA.program.id, suffix: runId(), facultyId: entitiesA.faculty.id });
    studentA1 = await createUser({ role: 'STUDENT', orgId: orgA.id, careerId: entitiesA.career.id, programId: entitiesA.program.id, cycle: 1, admissionPeriodId: entitiesA.period.id, suffix: runId() });

    orgB = await createOrganization('B');
    entitiesB = await createAcademicEntities(orgB.id, 'B');
    adminB = await createUser({ role: 'ADMIN', orgId: orgB.id, programId: entitiesB.program.id, suffix: runId(), facultyId: entitiesB.faculty.id });
    teacherB1 = await createUser({ role: 'TEACHER', orgId: orgB.id, programId: entitiesB.program.id, suffix: runId(), facultyId: entitiesB.faculty.id });
    studentB1 = await createUser({ role: 'STUDENT', orgId: orgB.id, careerId: entitiesB.career.id, programId: entitiesB.program.id, cycle: 1, admissionPeriodId: entitiesB.period.id, suffix: runId() });
  });

  afterAll(async () => { await cleanupDatabase(); });

  it('Career Isolation: Student de careerA NO puede evaluar assignment de careerB', async () => {
    const assignB = await createAssignment({ orgId: orgA.id, periodId: entitiesA.period.id, careerId: entitiesA.careerB.id, courseId: entitiesA.courseB.id, teacherId: teacherA2.id, cycle: 1 });
    const res = await request(app).post(`${BASE}/evaluation-responses`).set('Authorization', `Bearer ${makeToken(studentA1)}`).send({ teachingAssignmentId: assignB.id });
    expect(res.status).toBe(403);
  });

  it('Cycle & Period Isolation: rechaza ciclo y período diferentes', async () => {
    const periodWrong = await prisma.academicPeriod.create({ data: { name: `WrongPeriod ${runId()}`, startDate: new Date('2028-01-01'), endDate: new Date('2028-06-30'), isActive: true } });
    const assignWrongCycle = await createAssignment({ orgId: orgA.id, periodId: entitiesA.period.id, careerId: entitiesA.career.id, courseId: entitiesA.course.id, teacherId: teacherA1.id, cycle: 5 });
    const assignWrongPeriod = await createAssignment({ orgId: orgA.id, periodId: periodWrong.id, careerId: entitiesA.career.id, courseId: entitiesA.course.id, teacherId: teacherA1.id, cycle: 1 });
    
    const resCycle = await request(app).post(`${BASE}/evaluation-responses`).set('Authorization', `Bearer ${makeToken(studentA1)}`).send({ teachingAssignmentId: assignWrongCycle.id });
    expect(resCycle.status).toBe(403);
    
    const resPeriod = await request(app).post(`${BASE}/evaluation-responses`).set('Authorization', `Bearer ${makeToken(studentA1)}`).send({ teachingAssignmentId: assignWrongPeriod.id });
    expect(resPeriod.status).toBe(403);
  });

  it('Ownership: StudentB NO puede acceder, modificar ni eliminar response de StudentA', async () => {
    const crit = await createCriterion(orgA.id, 'OwnershipCrit');
    const assignment = await createAssignment({ orgId: orgA.id, periodId: entitiesA.period.id, careerId: entitiesA.career.id, courseId: entitiesA.course.id, teacherId: teacherA1.id, cycle: 1 });
    const responseA = await createResponse(assignment.id, studentA1.id);
    await createDetail(responseA.id, crit.id, 4);

    const resGet = await request(app).get(`${BASE}/evaluation-responses/${responseA.id}`).set('Authorization', `Bearer ${makeToken(studentB1)}`);
    expect(resGet.status).toBe(403);

    const resPut = await request(app).put(`${BASE}/evaluation-responses/${responseA.id}/details/${crit.id}`).set('Authorization', `Bearer ${makeToken(studentB1)}`).send({ score: 3 });
    expect(resPut.status).toBe(403);

    const resDel = await request(app).delete(`${BASE}/evaluation-responses/${responseA.id}`).set('Authorization', `Bearer ${makeToken(studentB1)}`);
    expect(resDel.status).toBe(403);
  });

  it('Organization Isolation: adminA no puede ver, modificar ni eliminar datos de orgB', async () => {
    const critB = await createCriterion(orgB.id, 'OrgBCritModify');
    const resGet = await request(app).get(`${BASE}/evaluation-results/teacher/${teacherB1.id}/summary`).set('Authorization', `Bearer ${makeToken(adminA)}`);
    expect(resGet.status).toBe(403);

    const resPut = await request(app).put(`${BASE}/evaluation-criteria/${critB.id}`).set('Authorization', `Bearer ${makeToken(adminA)}`).send({ name: 'Hacked' });
    expect(resPut.status).toBe(403);

    const resDel = await request(app).delete(`${BASE}/evaluation-criteria/${critB.id}`).set('Authorization', `Bearer ${makeToken(adminA)}`);
    expect(resDel.status).toBe(403);
  });
});