// src/modules/certificate/certificate.repository.js
// Acceso a datos (Prisma) de certificados oficiales de FERIAS.
//
// Consultas mínimas:
//   - listMembers de un proyecto (para PARTICIPATION / WINNER).
//   - find existente por (fair, project, user, type) para idempotencia.
//   - findById para lectura individual.
//   - listMine para la vista del propio participante.
//   - create con UNIQUE → P2002 si ya existe (la idempotencia se resuelve
//     en service usando findExisting + create, no con upsert, para poder
//     distinguir la creación del reuso).
//
// NO consulta promedios ni recalcula el ranking: eso se delega a
// fairResult.service.getFairResults() desde certificate.service.

import { prisma } from '../../database/prisma.js';
import { Prisma } from '@prisma/client';

const CERTIFICATE_SELECT = {
  id: true,
  userId: true,
  projectId: true,
  fairId: true,
  certificateType: true,
  issueDate: true,
  description: true,
  validUntil: true,
  fair: {
    select: { id: true, name: true, organizationId: true, status: true },
  },
  project: {
    select: {
      id: true,
      fairId: true,
      organizationId: true,
      name: true,
      status: true,
    },
  },
  user: {
    select: { id: true, firstName: true, lastName: true, role: true },
  },
};

const handlePrismaError = (error) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') return null;
    if (error.code === 'P2002') throw new Error('CERTIFICATE_ALREADY_EXISTS');
    if (error.code === 'P2003') throw new Error('CERTIFICATE_FOREIGN_KEY');
  }
  throw error;
};

/** Miembros de un proyecto (única fuente de verdad de los participantes). */
export const listProjectMembers = (projectId) =>
  prisma.projectMember.findMany({
    where: { projectId },
    select: {
      id: true,
      projectId: true,
      userId: true,
      role: true,
    },
    orderBy: { createdAt: 'asc' },
  });

/** Busca un certificado existente por la clave natural (fair, project, user, type). */
export const findExisting = ({ fairId, projectId, userId, certificateType }) =>
  prisma.certificate.findUnique({
    where: {
      unique_certificate_per_user_project_fair_type: {
        fairId,
        projectId,
        userId,
        certificateType,
      },
    },
    select: CERTIFICATE_SELECT,
  });

export const findById = (id) =>
  prisma.certificate.findUnique({
    where: { id },
    select: CERTIFICATE_SELECT,
  });

export const listMine = (userId) =>
  prisma.certificate.findMany({
    where: { userId },
    select: CERTIFICATE_SELECT,
    orderBy: { issueDate: 'desc' },
  });

export const create = async ({ fairId, projectId, userId, certificateType, description = null }) => {
  try {
    return await prisma.certificate.create({
      data: {
        fairId,
        projectId,
        userId,
        certificateType,
        description,
      },
      select: CERTIFICATE_SELECT,
    });
  } catch (error) {
    return handlePrismaError(error);
  }
};

export default {
  listProjectMembers,
  findExisting,
  findById,
  listMine,
  create,
};