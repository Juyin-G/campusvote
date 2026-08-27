// src/modules/voter_registry/voter_registry.repository.js

import { Prisma } from '@prisma/client';
import prisma from '../../config/prisma.js'; // Ajustar según la ruta del cliente de Prisma

/**
 * Repositorio de acceso a datos para reclamos y padrón electoral.
 * Aísla las consultas directas de Prisma y las ejecuciones SQL puras.
 */
export class VoterRegistryRepository {
  /**
   * Crea un reclamo en la base de datos.
   *
   * @param {Object} data - Objeto con datos del reclamo.
   * @returns {Promise<Object>} Registro creado en voter_registry_claims.
   */
  static async createClaim(data) {
    return await prisma.voterRegistryClaim.create({
      data: {
        userId: data.userId,
        periodId: data.periodId,
        claimType: data.claimType,
        description: data.description,
        supportingDocumentUrl: data.supportingDocumentUrl || null,
        status: 'PENDING',
      },
    });
  }

  /**
   * Busca un reclamo en estado PENDING activo para un usuario en un período específico.
   *
   * @param {string} userId - UUID del usuario.
   * @param {string} periodId - UUID del período académico.
   * @returns {Promise<Object|null>}
   */
  static async findPendingClaimByUserAndPeriod(userId, periodId) {
    return await prisma.voterRegistryClaim.findFirst({
      where: {
        userId,
        periodId,
        status: 'PENDING',
      },
    });
  }

  /**
   * Busca un reclamo por su ID único.
   *
   * @param {string} claimId - UUID del reclamo.
   * @returns {Promise<Object|null>}
   */
  static async findClaimById(claimId) {
    return await prisma.voterRegistryClaim.findUnique({
      where: { id: claimId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
            institutionalId: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Ejecuta la función PL/pgSQL `resolve_voter_registry_claim` para procesar la resolución.
   *
   * @param {string} claimId - UUID del reclamo.
   * @param {string} reviewerUserId - UUID del usuario staff/revisor.
   * @param {'APPROVED' | 'REJECTED'} newStatus - Nuevo estado.
   * @param {string|null} resolutionNotes - Detalle/nota del revisor.
   * @returns {Promise<void>}
   */
  static async executeResolveClaimFunction(claimId, reviewerUserId, newStatus, resolutionNotes = null) {
    await prisma.$executeRaw`
      SELECT resolve_voter_registry_claim(
        ${claimId}::uuid,
        ${reviewerUserId}::uuid,
        ${newStatus}::voter_claim_status,
        ${resolutionNotes}
      )
    `;
  }

  /**
   * Obtiene la lista paginada de reclamos y el total de coincidencias.
   *
   * @param {Object} params - Objeto con { where, skip, limit }.
   * @returns {Promise<[number, Array]>} Retorna [totalCount, items].
   */
  static async findManyClaimsWithPagination({ where, skip, limit }) {
    return await prisma.$transaction([
      prisma.voterRegistryClaim.count({ where }),
      prisma.voterRegistryClaim.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              firstName: true,
              lastName: true,
              institutionalId: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);
  }

  /**
   * Consulta el registro de padrón (voter_registries) de un usuario en un período.
   *
   * @param {string} userId - UUID del usuario.
   * @param {string} periodId - UUID del período académico.
   * @returns {Promise<Object|null>}
   */
  static async findRegistryByUserAndPeriod(userId, periodId) {
    return await prisma.voterRegistry.findFirst({
      where: {
        userId,
        periodId,
      },
    });
  }
}