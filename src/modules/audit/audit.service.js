import crypto from 'crypto';
import auditRepository from './audit.repository.js';
import { AUDIT_ACTIONS } from './audit.schema.js';
import { ApiError } from '../../shared/errors/ApiError.js';

class AuditService {
  /**
   * AUDIT LOGS - SERVICIOS
   */

  // CAMBIO: la firma ahora recibe el actor. El filtro server-side garantiza
  // que solo ADMIN del propio tenant vean logs cuyo actor pertenece a su
  // misma organización. Cualquier intento de pasar organizationId desde el
  // cliente es IGNORADO.
  async getAuditLogs(filters, actor) {
    if (!actor) {
      throw new Error('Actor requerido para consultar auditoría');
    }

    const organizationId = actor.organizationId;

    if (!organizationId) {
      throw new Error('El administrador de plataforma no tiene acceso a logs de tenant');
    }

    const safeFilters = { ...filters, organizationId };
    delete safeFilters.actorOrganizationId;
    delete safeFilters.scope;

    try {
      return await auditRepository.findAuditLogs(safeFilters, organizationId);
    } catch (error) {
      // CAMBIO: si el repository rechaza por falta de organizationId
      // (statusCode 403), se traduce a ApiError para que el controller
      // devuelva 403 explícito en lugar de 500.
      if (error?.statusCode === 403) {
        throw ApiError.forbidden('El administrador de plataforma no tiene acceso a logs de tenant');
      }
      console.error('Error al consultar audit logs:', error);
      throw new Error('No se pudieron recuperar los registros de auditoría');
    }
  }

  async getAuditLogById(id) {
    try {
      const log = await auditRepository.findAuditLogById(id);
      if (!log) {
        throw new Error('Registro de auditoría no encontrado');
      }
      return log;
    } catch (error) {
      if (error.message.includes('no encontrado')) throw error;
      console.error('Error al obtener audit log:', error);
      throw new Error('No se pudo recuperar el registro de auditoría');
    }
  }

  /**
   * Verifica la integridad de la cadena de hashes (inmutabilidad de la auditoría).
   * Requiere la función SQL verify_audit_chain() (audit/003).
   */
  async verifyChain() {
    try {
      const report = await auditRepository.verifyAuditChain();
      if (!report) {
        return { is_valid: false, message: 'No se pudo leer la cadena de auditoría' };
      }
      return {
        total_records: Number(report.total_records ?? 0),
        is_valid: Boolean(report.is_valid),
        first_broken_id: report.first_broken_id ?? null,
        first_broken_sequence: report.first_broken_sequence ?? null,
        checked_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error verificando la cadena de auditoría:', error);
      throw new Error('No se pudo verificar la cadena de auditoría');
    }
  }

  async logAction(logData) {
    const {
      actorId,
      action,
      ipAddress,
      metadata = {}
    } = logData;

    if (!Object.values(AUDIT_ACTIONS).includes(action)) {
      throw new Error(`Acción de auditoría inválida: ${action}`);
    }

    // HMAC generado sobre el contenido del evento.
    // La base de datos asignará de forma determinista previous_hash y current_hash.
    const payloadToSign = `${action}:${actorId || ''}:${JSON.stringify(metadata)}`;
    const signature = this._signPayload(payloadToSign);

    try {
      return await auditRepository.createAuditLog({
        actorId,
        action,
        ipAddress,
        metadata,
        signature
      });
    } catch (error) {
      console.error('Error al registrar audit log:', error);
      throw error;
    }
  }

  _signPayload(payload) {
    const secret = process.env.AUDIT_SECRET_KEY;
    if (!secret) {
      throw new Error('AUDIT_SECRET_KEY no está configurada');
    }
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }
}

export default new AuditService();