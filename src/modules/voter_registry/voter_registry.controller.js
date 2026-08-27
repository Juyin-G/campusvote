// src/modules/voter_registry/voter_registry.controller.js

import { VoterRegistryService } from './voter_registry.service.js';

/**
 * Controlador HTTP para las peticiones del padrón electoral y reclamos.
 */
export class VoterRegistryController {
  /**
   * POST /api/v1/voter-registry/claims
   * Crea un nuevo reclamo de padrón para el usuario autenticado.
   */
  static async createClaim(req, res, next) {
    try {
      const userId = req.user.id; // Proveniente del middleware de autenticación (JWT)
      const claimData = req.body;

      const newClaim = await VoterRegistryService.createClaim(userId, claimData);

      return res.status(201).json({
        success: true,
        message: 'Reclamo registrado exitosamente.',
        data: newClaim,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/voter-registry/claims/:claimId/resolve
   * Resuelve un reclamo existente (solo Staff / Comisión Electoral).
   */
  static async resolveClaim(req, res, next) {
    try {
      const { claimId } = req.params;
      const reviewerUserId = req.user.id;
      const { status, resolutionNotes } = req.body;

      const result = await VoterRegistryService.resolveClaim(
        claimId,
        reviewerUserId,
        status,
        resolutionNotes
      );

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/voter-registry/claims
   * Obtiene un listado paginado de reclamos con filtros (Admin / Staff).
   */
  static async getClaims(req, res, next) {
    try {
      const filters = req.query;
      const result = await VoterRegistryService.getClaims(filters);

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/voter-registry/status
   * Consulta el estado de elegibilidad en el padrón del usuario autenticado para un período.
   */
  static async getMyRegistryStatus(req, res, next) {
    try {
      const userId = req.user.id;
      const { periodId } = req.query;

      const registryStatus = await VoterRegistryService.getRegistryStatus(userId, periodId);

      return res.status(200).json({
        success: true,
        data: registryStatus || {
          isEligible: false,
          eligibilityReason: 'NOT_FOUND_IN_REGISTRY',
        },
      });
    } catch (error) {
      next(error);
    }
  }
}