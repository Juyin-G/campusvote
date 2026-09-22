/**
 * FairStatusTransition — pruebas de integración HTTP + BD (Parte 3).
 * Verifica la MÁQUINA DE ESTADOS de la feria reforzada en PostgreSQL:
 *   - DRAFT -> OPEN permitido.
 *   - OPEN  -> CLOSED permitido.
 *   - CLOSED es terminal.
 *   - OPEN  -> DRAFT prohibido si existe participación (votos o rúbricas
 *     finalizadas) y permitido si no la hay.
 * También confirma que la participación existente NO se altera al bloquear.
 */
import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';

jest.unstable_mockModule('../../src/middlewares/rateLimiter.middleware.js', () => ({
  loginLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  userLimiter: () => (_req, _res, next) => next(),
  userElectionLimiter: () => (_req, _res, next) => next(),
}));

const { prisma } = await import('../../src/database/prisma.js');

const PASSWORD = 'FairStatusTest123!';
const runId = Date.now();

let orgAId;
let studentId;
let juryId;

const createUser = async ({ role, organizationId, suffix }) =>
  prisma.user.create({
    data: {
      username: `fst.${role.toLowerCase()}.${suffix}.${runId}`,
      email: `fst.${role.toLowerCase()}.${suffix}.${runId}@campusvote.edu.pe`,
      password: await bcrypt.hash(PASSWORD, 12),
      firstName: role,
      lastName: suffix,
      institutionalId: `FST${suffix}${runId}`,
      role,
      // chk_users_scope_admin_only: todo ADMIN tiene alcance; el resto, ninguno.
      scopeLevel: role === 'ADMIN' ? 'ORG' : null,
      authProvider: 'LOCAL',
      isVerified: true,
      status: 'ACTIVE',
      mustChangePassword: false,
      organizationId,
    },
  });

const crearProyecto = ({ fairId, name }) =>
  prisma.project.create({
    data: {
      organizationId: orgAId,
      fairId,
      createdById: studentId,
      name,
      status: 'APPROVED',
      // chk_projects_review_consistency exige reviewed_at para APPROVED/REJECTED.
      reviewedAt: new Date(),
    },
  });

const crearRubricConCriterio = async (fairId) => {
  const rubric = await prisma.fairRubric.create({ data: { fairId, name: 'Rúbrica FST' } });
  await prisma.rubricCriterion.create({
    data: { rubricId: rubric.id, name: 'Criterio', position: 1, isActive: true },
  });
  return rubric.id;
};

const intentarCambiarEstado = async (fairId, status) => {
  try {
    await prisma.fair.update({ where: { id: fairId }, data: { status } });
    return null;
  } catch (err) {
    return err;
  }
};

async function setup() {
  const orgA = await prisma.organization.create({
    data: { name: `OrgA FST ${runId}`, code: `ORAFST${runId}` },
  });
  orgAId = orgA.id;

  const student = await createUser({ role: 'STUDENT', organizationId: orgA.id, suffix: 'Stud' });
  const jury = await createUser({ role: 'JURY', organizationId: orgA.id, suffix: 'Jury' });
  studentId = student.id;
  juryId = jury.id;
}

describe('FairStatusTransition — PostgreSQL (Parte 3)', () => {
  beforeAll(setup);
  afterAll(async () => prisma.$disconnect());

  it('DRAFT -> OPEN está permitido', async () => {
    const fair = await prisma.fair.create({
      data: { organizationId: orgAId, name: `FST Draft ${runId}`, status: 'DRAFT' },
    });
    const err = await intentarCambiarEstado(fair.id, 'OPEN');
    expect(err).toBeNull();

    const actualizado = await prisma.fair.findUnique({ where: { id: fair.id } });
    expect(actualizado.status).toBe('OPEN');
  });

  it('OPEN -> CLOSED está permitido', async () => {
    const fair = await prisma.fair.create({
      data: { organizationId: orgAId, name: `FST Open ${runId}`, status: 'OPEN' },
    });
    const err = await intentarCambiarEstado(fair.id, 'CLOSED');
    expect(err).toBeNull();
    expect((await prisma.fair.findUnique({ where: { id: fair.id } })).status).toBe('CLOSED');
  });

  it('CLOSED es terminal (CLOSED -> OPEN falla)', async () => {
    const fair = await prisma.fair.create({
      data: { organizationId: orgAId, name: `FST Closed ${runId}`, status: 'CLOSED' },
    });
    const err = await intentarCambiarEstado(fair.id, 'OPEN');
    expect(err).not.toBeNull();
    expect(String(err.message)).toMatch(/Transición/i);
    expect((await prisma.fair.findUnique({ where: { id: fair.id } })).status).toBe('CLOSED');
  });

  it('OPEN -> DRAFT SIN participación está permitido', async () => {
    const fair = await prisma.fair.create({
      data: { organizationId: orgAId, name: `FST SinPart ${runId}`, status: 'OPEN' },
    });
    const err = await intentarCambiarEstado(fair.id, 'DRAFT');
    expect(err).toBeNull();
    expect((await prisma.fair.findUnique({ where: { id: fair.id } })).status).toBe('DRAFT');
  });

  it('OPEN -> DRAFT CON votos emitidos falla y NO borra la participación', async () => {
    const fair = await prisma.fair.create({
      data: { organizationId: orgAId, name: `FST ConVotos ${runId}`, status: 'OPEN' },
    });
    await prisma.fairJuryAssignment.create({
      data: { fairId: fair.id, userId: juryId, assignedById: studentId },
    });
    const proyecto = await crearProyecto({ fairId: fair.id, name: 'Proyecto Voto' });

    // Voto anónimo válido (trigger exige fair OPEN + jury asignado).
    await prisma.fairVote.create({
      data: { fairId: fair.id, projectId: proyecto.id, receiptCode: `RCPT-${runId}` },
    });
    await prisma.fairVoteParticipation.create({
      data: { fairId: fair.id, juryUserId: juryId },
    });

    const err = await intentarCambiarEstado(fair.id, 'DRAFT');
    expect(err).not.toBeNull();
    expect(String(err.message)).toMatch(/participaci/i);

    // El estado permanece OPEN y la participación sigue intacta.
    expect((await prisma.fair.findUnique({ where: { id: fair.id } })).status).toBe('OPEN');
    const participaciones = await prisma.fairVoteParticipation.count({
      where: { fairId: fair.id },
    });
    expect(participaciones).toBe(1);
  });

  it('OPEN -> DRAFT CON rúbricas finalizadas falla y NO borra la rúbrica', async () => {
    const fair = await prisma.fair.create({
      data: { organizationId: orgAId, name: `FST ConRubrica ${runId}`, status: 'OPEN' },
    });
    await prisma.fairJuryAssignment.create({
      data: { fairId: fair.id, userId: juryId, assignedById: studentId },
    });
    const proyecto = await crearProyecto({ fairId: fair.id, name: 'Proyecto Rúbrica' });
    const rubricId = await crearRubricConCriterio(fair.id);

    // Rúbrica FINALIZADA (submitted_at NOT NULL).
    await prisma.fairEvaluation.create({
      data: {
        fairId: fair.id,
        projectId: proyecto.id,
        juryUserId: juryId,
        rubricId,
        submittedAt: new Date(),
      },
    });

    const err = await intentarCambiarEstado(fair.id, 'DRAFT');
    expect(err).not.toBeNull();
    expect(String(err.message)).toMatch(/participaci/i);

    expect((await prisma.fair.findUnique({ where: { id: fair.id } })).status).toBe('OPEN');
    const finalizadas = await prisma.fairEvaluation.count({
      where: { fairId: fair.id, submittedAt: { not: null } },
    });
    expect(finalizadas).toBe(1);
  });

  it('OPEN -> DRAFT con rúbrica NO finalizada (submitted_at NULL) sigue permitido', async () => {
    const fair = await prisma.fair.create({
      data: { organizationId: orgAId, name: `FST RubricaBorrador ${runId}`, status: 'OPEN' },
    });
    await prisma.fairJuryAssignment.create({
      data: { fairId: fair.id, userId: juryId, assignedById: studentId },
    });
    const proyecto = await crearProyecto({ fairId: fair.id, name: 'Proyecto Borrador' });
    const rubricId = await crearRubricConCriterio(fair.id);

    // Hoja de respuesta SIN finalizar.
    await prisma.fairEvaluation.create({
      data: {
        fairId: fair.id,
        projectId: proyecto.id,
        juryUserId: juryId,
        rubricId,
        submittedAt: null,
      },
    });

    const err = await intentarCambiarEstado(fair.id, 'DRAFT');
    expect(err).toBeNull();
    expect((await prisma.fair.findUnique({ where: { id: fair.id } })).status).toBe('DRAFT');
  });
});