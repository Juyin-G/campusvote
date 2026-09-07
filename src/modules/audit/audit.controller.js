// src/modules/audit/audit.controller.js

import auditService from './audit.service.js';
import { isAdminRole } from '../../constants/roles.js';
import { 
  auditLogsQuerySchema, 
  createAuditLogSchema,
  createOneTimeTokenSchema, 
  consumeOneTimeTokenSchema,
  checkTokenStatusSchema
} from './audit.schema.js';

class AuditController {
  /**
   * AUDIT LOGS - CONTROLADORES
   */

  // GET /audit/verify — Verifica la integridad de la cadena de hashes
  async verifyAuditChain(req, res, next) {
    try {
      const report = await auditService.verifyChain();
      return res.status(200).json({ success: true, data: report });
    } catch (error) {
      console.error('[AuditController] Error al verificar la cadena:', error);
      return next(error);
    }
  }

  // GET /audit/logs - Consultar logs con filtros
  async getAuditLogs(req, res, next) {
    try {
      const { error, value } = auditLogsQuerySchema.validate(req.query);
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Parámetros de consulta inválidos',
            details: error.details.map(d => d.message)
          }
        });
      }

      const result = await auditService.getAuditLogs(value);

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Error en getAuditLogs:', error);
      return res.status(500).json({
        success: false,
        error: { message: 'Error al consultar logs de auditoría' }
      });
    }
  }

  // GET /audit/logs/:id - Obtener log específico
  async getAuditLogById(req, res, next) {
    try {
      const { id } = req.params;

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!id || !uuidRegex.test(id)) {
        return res.status(400).json({
          success: false,
          error: { message: 'ID de auditoría inválido' }
        });
      }

      const log = await auditService.getAuditLogById(id);

      return res.status(200).json({
        success: true,
        data: log
      });
    } catch (error) {
      console.error('Error en getAuditLogById:', error);
      
      if (error.message.includes('no encontrado')) {
        return res.status(404).json({
          success: false,
          error: { message: error.message }
        });
      }

      return res.status(500).json({
        success: false,
        error: { message: 'Error al obtener el registro de auditoría' }
      });
    }
  }

  // POST /audit/logs - Registrar nueva acción (Auditoría con actorId)
  // src/modules/audit/audit.controller.js

  async createAuditLog(req, res, next) {
    try {
      const { error, value: logPayload } = createAuditLogSchema.validate(req.body);

      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Datos de auditoría inválidos',
            details: error.details.map((d) => d.message),
          },
        });
      }

      const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;

      const logData = {
        actorId: req.user?.userId ?? req.user?.id ?? null,
        electionId: logPayload.electionId || null,
        action: logPayload.action,
        ipAddress: clientIp,
        metadata: logPayload.metadata || {},
      };

      const newLog = await auditService.logAction(logData);

      return res.status(201).json({
        success: true,
        data: newLog,
        message: 'Registro de auditoría creado exitosamente',
      });
    } catch (error) {
      console.error('[AuditController] Error al crear log:', error);

      // Corregido (S2.5): Evita fuga de información cruda en producción
      const isClientError = error?.message?.includes('inválida') || error?.message?.includes('secreto');
      
      if (isClientError) {
        const safeMessage = process.env.NODE_ENV === 'production'
          ? 'Acción de auditoría inválida'
          : error.message;

        return res.status(400).json({
          success: false,
          error: { message: safeMessage },
        });
      }

      return res.status(500).json({
        success: false,
        error: { message: 'Error al crear registro de auditoría' },
      });
    }
  }

  /**
   * VOTING / ONE-TIME TOKENS - CONTROLADORES
   */

  // POST /audit/tokens - Crear token de un solo uso
  async createOneTimeToken(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { message: 'Usuario no autenticado' }
        });
      }

      const { error, value } = createOneTimeTokenSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Datos inválidos',
            details: error.details.map(d => d.message)
          }
        });
      }

      const actorId = req.user?.userId ?? req.user?.id;
      const targetUserId = value.userId || actorId;

      // Validación de propiedad: sólo gestores/admins pueden crear tokens para otros usuarios
      if (actorId !== targetUserId && !isAdminRole(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: { message: 'No tiene permisos para crear tokens para este usuario' }
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
        message: 'Token creado exitosamente. Guárdelo, no se mostrará nuevamente.'
      });
    } catch (error) {
      console.error('Error en createOneTimeToken:', error);
      
      if (error.message.includes('Ya existe')) {
        return res.status(409).json({
          success: false,
          error: { message: error.message }
        });
      }

      return res.status(500).json({
        success: false,
        error: { message: 'Error al crear token de un solo uso' }
      });
    }
  }

  // POST /audit/tokens/consume - Consumir token para proceso electoral
  async consumeOneTimeToken(req, res, next) {
    try {
      const { error, value } = consumeOneTimeTokenSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Datos inválidos',
            details: error.details.map(d => d.message)
          }
        });
      }

      await auditService.consumeOneTimeToken(
        value.rawToken,
        value.electionId
      );

      return res.status(200).json({
        success: true,
        data: {
          consumed: true,
          message: 'Token consumido exitosamente. Puede proceder a votar.'
        }
      });
    } catch (error) {
      console.error('Error en consumeOneTimeToken:', error);
      
      const msg = error.message.toLowerCase();

      if (msg.includes('expirado')) {
        return res.status(410).json({
          success: false,
          error: { message: 'El token ha expirado' }
        });
      }

      if (msg.includes('utilizado') || msg.includes('usado')) {
        return res.status(409).json({
          success: false,
          error: { message: 'El token ya ha sido utilizado' }
        });
      }

      if (msg.includes('inválido') || msg.includes('no pertenece') || msg.includes('no encontrado')) {
        return res.status(404).json({
          success: false,
          error: { message: 'Token inválido o no pertenece a esta elección' }
        });
      }

      return res.status(500).json({
        success: false,
        error: { message: 'Error al validar el token' }
      });
    }
  }

  // GET /audit/tokens/status - Verificar estado de token (sin consumirlo)
  async checkTokenStatus(req, res, next) {
    try {
      const { error, value: queryParams } = checkTokenStatusSchema.validate(req.query);
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Parámetros de consulta inválidos',
            details: error.details.map(d => d.message)
          }
        });
      }

      const status = await auditService.checkTokenStatus(queryParams.token, queryParams.electionId);

      return res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Error en checkTokenStatus:', error);
      return res.status(500).json({
        success: false,
        error: { message: 'Error al verificar el estado del token' }
      });
    }
  }

  // DELETE /audit/tokens/cleanup - Limpieza de tokens expirados (admin/cron)
  async cleanupExpiredTokens(req, res, next) {
    try {
      if (!isAdminRole(req.user?.role) && !req.internal) {
        return res.status(403).json({
          success: false,
          error: { message: 'Acceso denegado' }
        });
      }

      const result = await auditService.cleanupExpiredTokens();

      return res.status(200).json({
        success: true,
        data: result,
        message: 'Limpieza completada'
      });
    } catch (error) {
      console.error('Error en cleanupExpiredTokens:', error);
      return res.status(500).json({
        success: false,
        error: { message: 'Error en la limpieza de tokens' }
      });
    }
  }
}

export default new AuditController();