// src/modules/publicRegistration/publicRegistration.repository.js
// Acceso a datos de la PÁGINA PÚBLICA de inscripción de proyectos.

import { prisma } from '../../database/prisma.js';

const PARTICIPANT_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  organizationId: true,
};

/**
 * Persona de la institución que puede usar la página: alumno o docente ACTIVO
 * de la organización dueña de la feria. El correo es CITEXT: no distingue
 * mayúsculas.
 */
export const findParticipantByEmail = ({ email, organizationId }) =>
  prisma.user.findFirst({
    where: {
      email,
      organizationId,
      status: 'ACTIVE',
      role: { in: ['STUDENT', 'TEACHER'] },
    },
    select: PARTICIPANT_SELECT,
  });

export const findParticipantById = (id) =>
  prisma.user.findUnique({ where: { id }, select: PARTICIPANT_SELECT });

/** Borra los códigos previos de esa persona en esa feria (solo vale el último). */
export const deleteCodesFor = ({ fairId, userId }) =>
  prisma.fairRegistrationCode.deleteMany({ where: { fairId, userId } });

export const createCode = ({ fairId, userId, codeHash, expiresAt }) =>
  prisma.fairRegistrationCode.create({
    data: { fairId, userId, codeHash, expiresAt },
    select: { id: true, expiresAt: true },
  });

export const findLastCode = ({ fairId, userId }) =>
  prisma.fairRegistrationCode.findFirst({
    where: { fairId, userId, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

export const registerAttempt = (id) =>
  prisma.fairRegistrationCode.update({
    where: { id },
    data: { attempts: { increment: 1 } },
    select: { id: true, attempts: true },
  });

export const deleteCodeById = (id) =>
  prisma.fairRegistrationCode.delete({ where: { id } }).catch(() => null);

export const consumeCode = ({ id, sessionHash, sessionExpiresAt }) =>
  prisma.fairRegistrationCode.update({
    where: { id },
    data: { consumedAt: new Date(), sessionHash, sessionExpiresAt },
    select: { id: true, sessionExpiresAt: true },
  });

/** Sesión temporal vigente de la página pública (o null). */
export const findSession = ({ fairId, sessionHash }) =>
  prisma.fairRegistrationCode.findFirst({
    where: {
      fairId,
      sessionHash,
      sessionExpiresAt: { gt: new Date() },
    },
    select: { id: true, userId: true, sessionExpiresAt: true },
  });

/**
 * Proyecto de esa persona en esa feria: el que inscribió o aquel del que es
 * integrante. Es lo que la página muestra al volver a entrar.
 */
export const findProjectOfParticipant = ({ fairId, userId }) =>
  prisma.project.findFirst({
    where: {
      fairId,
      OR: [{ createdById: userId }, { members: { some: { userId } } }],
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      reviewNotes: true,
      reviewedAt: true,
      submittedAt: true,
      createdById: true,
      categoryId: true,
      category: { select: { id: true, name: true } },
      members: {
        select: {
          role: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        },
      },
    },
  });

/** Participación de esa persona en CUALQUIER proyecto de la feria (o null). */
export const findParticipationInFair = ({ fairId, userId }) =>
  prisma.projectMember.findFirst({
    where: { userId, project: { fairId } },
    select: { project: { select: { id: true, name: true } } },
  });

/** Borra una inscripción a medio crear (rollback del formulario público). */
export const deleteProject = (projectId) =>
  prisma.project.delete({ where: { id: projectId } }).catch(() => null);

export default {
  findParticipantByEmail,
  findParticipationInFair,
  deleteProject,
  findParticipantById,
  deleteCodesFor,
  createCode,
  findLastCode,
  registerAttempt,
  deleteCodeById,
  consumeCode,
  findSession,
  findProjectOfParticipant,
};
