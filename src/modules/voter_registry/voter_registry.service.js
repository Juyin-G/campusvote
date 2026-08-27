// src/modules/voter_registry/voter_registry.service.js

import { Prisma } from '@prisma/client';
import prisma from '../../config/prisma.js'; // Ajustar ruta según la estructura del proyecto

/**
 * Servicio para la gestión del padrón electoral y resolución de reclamos.
 */
export class VoterRegistryService {
  /**
   * Crea un nuevo reclamo de padrón electoral para el usuario autenticado.
   *
   * @param {string} userId - ID del usuario que emite el reclamo.
   * @param {Object} data - Datos del reclamo (periodId, claimType, description, supportingDocumentUrl).
   * @returns {Promise<Object>} Reclamo creado.
   */
  static async createClaim(userId, data) {
    const { periodId, claimType, description, supportingDocumentUrl } = data;

    // Verificar si ya existe un reclamo PENDING para este usuario y período
    const existingPendingClaim = await prisma.voterRegistryClaim.findFirst({
      where: {
        userId,
        periodId,
        status: 'PENDING',
      },
    });

    if (existingPendingClaim) {
      const error = new Error('Ya tienes un reclamo pendiente de resolución para este período académico.');
      error.statusCode = 409;
      throw error;
    }

    return await prisma.voterRegistryClaim.create({
      data: {
        userId,
        periodId,
        claimType,
        description,
        supportingDocumentUrl: supportingDocumentUrl || null,
        status: 'PENDING',
      },
    });
  }

  /**
   * Resuelve un reclamo de padrón invocando la función PL/pgSQL `resolve_voter_registry_claim`.
   * La función valida permisos del revisor, bloquea la fila (FOR UPDATE) y actualiza el padrón si es APPROVED.
   *
   * @param {string} claimId - UUID del reclamo a resolver.
   * @param {string} reviewerUserId - UUID del usuario staff/revisor.
   * @param {'APPROVED' | 'REJECTED'} newStatus - Nuevo estado terminal.
   * @param {string|null} resolutionNotes - Notas opcionales de la resolución.
   * @returns {Promise<{ message: string }>} Confirmación de la operación.
   */
  static async resolveClaim(claimId, reviewerUserId, newStatus, resolutionNotes = null) {
    try {
      await prisma.$executeRaw`
        SELECT resolve_voter_registry_claim(
          ${claimId}::uuid,
          ${reviewerUserId}::uuid,
          ${newStatus}::voter_claim_status,
          ${resolutionNotes}
        )
      `;

      return { message: `Reclamo resuelto exitosamente con estado: ${newStatus}` };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError || error.message.includes('RAISE EXCEPTION')) {
        // Capturar errores lanzados desde PL/pgSQL (e.g., "Usuario no autorizado", "Reclamo no encontrado")
        const customError = new Error(error.message || 'Error al procesar la resolución del reclamo.');
        customError.statusCode = 400;
        throw customError;
      }
      throw error;
    }
  }

  /**
   * Obtiene una lista paginada de reclamos con filtros opcionales.
   *
   * @param {Object} filters - Filtros de consulta (periodId, status, claimType, page, limit).
   * @returns {Promise<{ data: Array, total: number, page: number, totalPages: number }>}
   */
  static async getClaims(filters) {
    const { periodId, status, claimType, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where = {
      ...(periodId && { periodId }),
      ...(status && { status }),
      ...(claimType && { claimType }),
    };

    const [total, claims] = await prisma.$transaction([
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

    return {
      data: claims,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Consulta el estado de inclusión de un usuario en el padrón electoral para un período específico.
   *
   * @param {string} userId - ID del usuario.
   * @param {string} periodId - ID del período académico.
   * @returns {Promise<Object|null>}
   */
  static async getRegistryStatus(userId, periodId) {
    return await prisma.voterRegistry.findFirst({
      where: {
        userId,
        periodId,
      },
    });
  }
}