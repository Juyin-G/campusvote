// src/modules/audit/audit.logs.controller.js
// Endpoints HTTP de consulta y creación de logs de auditoría.

import auditService from './audit.service.js';
import { auditLogsQuerySchema, createAuditLogSchema } from './audit.schema.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class AuditLogsController {
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

  // GET /audit/logs — Consultar logs con filtros (filtro server-side por org).
  async getAuditLogs(req, res, next) {
    try {
      const { error, value } = auditLogsQuerySchema.validate(req.query);
      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Parámetros de consulta inválidos',
            details: error.details.map((d) => d.message),
          },
        });
      }
      const result = await auditService.getAuditLogs(value, req.user);
      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error('Error en getAuditLogs:', error);
      return res.status(500).json({
        success: false,
        error: { message: 'Error al consultar logs de auditoría' },
      });
    }
  }

  // GET /audit/logs/:id
  async getAuditLogById(req, res, next) {
    try {
      const { id } = req.params;
      if (!id || !UUID_REGEX.test(id)) {
        return res.status(400).json({
          success: false,
          error: { message: 'ID de auditoría inválido' },
        });
      }
      const log = await auditService.getAuditLogById(id);
      return res.status(200).json({ success: true, data: log });
    } catch (error) {
      console.error('Error en getAuditLogById:', error);
      if (error.message.includes('no encontrado')) {
        return res.status(404).json({
          success: false,
          error: { message: error.message },
        });
      }
      return res.status(500).json({
        success: false,
        error: { message: 'Error al obtener el registro de auditoría' },
      });
    }
  }

  // POST /audit/logs
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

      const clientIp =
        req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;

      const logData = {
        actorId: req.user?.userId ?? req.user?.id ?? null,
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
      const isClientError =
        error?.message?.includes('inválida') || error?.message?.includes('secreto');
      if (isClientError) {
        const safeMessage =
          process.env.NODE_ENV === 'production'
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
}

export default new AuditLogsController();
