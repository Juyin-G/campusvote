// src/modules/audit/audit.tokens.controller.js
// Endpoints HTTP de one-time tokens (crear, consumir, status, cleanup).

import auditService from './audit.service.js';
import { isAdminRole } from '../../constants/roles.js';
import {
  createOneTimeTokenSchema,
  consumeOneTimeTokenSchema,
  checkTokenStatusSchema,
} from './audit.schema.js';

class AuditTokensController {
  // POST /audit/tokens
  async createOneTimeToken(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { message: 'Usuario no autenticado' },
        });
      }
      const { error, value } = createOneTimeTokenSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Datos inválidos',
            details: error.details.map((d) => d.message),
          },
        });
      }

      const actorId = req.user?.userId ?? req.user?.id;
      const targetUserId = value.userId || actorId;
      if (actorId !== targetUserId && !isAdminRole(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: { message: 'No tiene permisos para crear tokens para este usuario' },
        });
      }

      const result = await auditService.createOneTimeToken({
        ...value,
        userId: targetUserId,
      });
      return res.status(201).json({
        success: true,
        data: result.tokenRecord,
        token: result.token,
        message: 'Token creado exitosamente. Guárdelo, no se mostrará nuevamente.',
      });
    } catch (error) {
      console.error('Error en createOneTimeToken:', error);
      if (error.message.includes('Ya existe')) {
        return res.status(409).json({
          success: false,
          error: { message: error.message },
        });
      }
      return res.status(500).json({
        success: false,
        error: { message: 'Error al crear token de un solo uso' },
      });
    }
  }

  // POST /audit/tokens/consume
  async consumeOneTimeToken(req, res, next) {
    try {
      const { error, value } = consumeOneTimeTokenSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Datos inválidos',
            details: error.details.map((d) => d.message),
          },
        });
      }
      await auditService.consumeOneTimeToken(value.rawToken, value.electionId);
      return res.status(200).json({
        success: true,
        data: {
          consumed: true,
          message: 'Token consumido exitosamente. Puede proceder a votar.',
        },
      });
    } catch (error) {
      console.error('Error en consumeOneTimeToken:', error);
      const msg = error.message.toLowerCase();
      if (msg.includes('expirado')) {
        return res.status(410).json({
          success: false,
          error: { message: 'El token ha expirado' },
        });
      }
      if (msg.includes('utilizado') || msg.includes('usado')) {
        return res.status(409).json({
          success: false,
          error: { message: 'El token ya ha sido utilizado' },
        });
      }
      if (
        msg.includes('inválido') ||
        msg.includes('no pertenece') ||
        msg.includes('no encontrado')
      ) {
        return res.status(404).json({
          success: false,
          error: { message: 'Token inválido o no pertenece a esta elección' },
        });
      }
      return res.status(500).json({
        success: false,
        error: { message: 'Error al validar el token' },
      });
    }
  }

  // GET /audit/tokens/status
  async checkTokenStatus(req, res, next) {
    try {
      const { error, value: queryParams } = checkTokenStatusSchema.validate(req.query);
      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Parámetros de consulta inválidos',
            details: error.details.map((d) => d.message),
          },
        });
      }
      const status = await auditService.checkTokenStatus(
        queryParams.token,
        queryParams.electionId
      );
      return res.status(200).json({ success: true, data: status });
    } catch (error) {
      console.error('Error en checkTokenStatus:', error);
      return res.status(500).json({
        success: false,
        error: { message: 'Error al verificar el estado del token' },
      });
    }
  }

  // DELETE /audit/tokens/cleanup (admin/cron)
  async cleanupExpiredTokens(req, res, next) {
    try {
      if (!isAdminRole(req.user?.role) && !req.internal) {
        return res.status(403).json({
          success: false,
          error: { message: 'Acceso denegado' },
        });
      }
      const result = await auditService.cleanupExpiredTokens();
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Limpieza completada',
      });
    } catch (error) {
      console.error('Error en cleanupExpiredTokens:', error);
      return res.status(500).json({
        success: false,
        error: { message: 'Error en la limpieza de tokens' },
      });
    }
  }
}

export default new AuditTokensController();
