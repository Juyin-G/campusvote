import { prisma, app, makeToken, createOrganization, createAcademicEntities, createUser, createCriterion, cleanupDatabase, BASE, runId } from './helpers.js';
describe('1. Criteria CRUD + Permissions', () => {
  let orgA, orgB, entitiesA, adminA, adminB;

  beforeAll(async () => {
    orgA = await createOrganization('A');
    entitiesA = await createAcademicEntities(orgA.id, 'A');
    adminA = await createUser({ role: 'ADMIN', orgId: orgA.id, programId: entitiesA.program.id, suffix: runId(), facultyId: entitiesA.faculty.id });
    
    orgB = await createOrganization('B');
    const entitiesB = await createAcademicEntities(orgB.id, 'B');
    adminB = await createUser({ role: 'ADMIN', orgId: orgB.id, programId: entitiesB.program.id, suffix: runId(), facultyId: entitiesB.faculty.id });
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it('POST /evaluation-criteria — ADMIN crea criterio', async () => {
    const res = await request(app)
      .post(`${BASE}/evaluation-criteria`)
      .set('Authorization', `Bearer ${makeToken(adminA)}`)
      .send({ name: 'Claridad Expositiva', description: 'Capacidad de explicar' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ organizationId: orgA.id, name: 'Claridad Expositiva', isActive: true });
  });

  it('POST — rechaza STUDENT', async () => {
    const student = await createUser({ role: 'STUDENT', orgId: orgA.id, careerId: entitiesA.career.id, programId: entitiesA.program.id, cycle: 1, admissionPeriodId: entitiesA.period.id, suffix: runId() });
    const res = await request(app).post(`${BASE}/evaluation-criteria`).set('Authorization', `Bearer ${makeToken(student)}`).send({ name: 'X' });
    expect(res.status).toBe(403);
  });

  it('POST — ADMIN de otra organización crea criterio con mismo nombre', async () => {
    const res = await request(app).post(`${BASE}/evaluation-criteria`).set('Authorization', `Bearer ${makeToken(adminB)}`).send({ name: 'Claridad Expositiva' });
    expect(res.status).toBe(201);
  });

  it('POST — UNIQUE(organization_id, name) previene duplicado', async () => {
    const res = await request(app).post(`${BASE}/evaluation-criteria`).set('Authorization', `Bearer ${makeToken(adminA)}`).send({ name: 'Claridad Expositiva' });
    expect(res.status).toBe(409);
  });

  it('PATCH toggle — activa/desactiva criterio', async () => {
    const crit = await createCriterion(orgA.id, 'ToggleTest');
    const res = await request(app).patch(`${BASE}/evaluation-criteria/${crit.id}/toggle`).set('Authorization', `Bearer ${makeToken(adminA)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('DELETE — puede eliminar si no tiene detalles', async () => {
    const crit = await createCriterion(orgA.id, 'ToDelete');
    const res = await request(app).delete(`${BASE}/evaluation-criteria/${crit.id}`).set('Authorization', `Bearer ${makeToken(adminA)}`);
    expect(res.status).toBe(200);
  });

  it('DELETE — no puede eliminar si tiene detalles (FK RESTRICT)', async () => {
    const crit = await createCriterion(orgA.id, 'WithDetails');
    const assignment = await createAssignment({ orgId: orgA.id, periodId: entitiesA.period.id, careerId: entitiesA.career.id, courseId: entitiesA.course.id, teacherId: (await createUser({ role: 'TEACHER', orgId: orgA.id, programId: entitiesA.program.id, suffix: runId(), facultyId: entitiesA.faculty.id })).id, cycle: 1 });
    const resp = await createResponse(assignment.id, (await createUser({ role: 'STUDENT', orgId: orgA.id, careerId: entitiesA.career.id, programId: entitiesA.program.id, cycle: 1, admissionPeriodId: entitiesA.period.id, suffix: runId() })).id);
    await createDetail(resp.id, crit.id, 4);
    const res = await request(app).delete(`${BASE}/evaluation-criteria/${crit.id}`).set('Authorization', `Bearer ${makeToken(adminA)}`);
    expect(res.status).toBe(409);
  });
});