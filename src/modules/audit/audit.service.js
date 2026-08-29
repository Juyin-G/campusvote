import crypto from 'crypto';
import auditRepository from './audit.repository.js';
import { AUDIT_ACTIONS } from './audit.schema.js';

class AuditService {
  /**
   * AUDIT LOGS - SERVICIOS
   */

  async getAuditLogs(filters) {
    try {
      return await auditRepository.findAuditLogs(filters);
    } catch (error) {
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

  async logAction(logData) {
    const {
      actorId,
      electionId,
      action,
      ipAddress,
      metadata = {}
    } = logData;

    if (!Object.values(AUDIT_ACTIONS).includes(action)) {
      throw new Error(`Acción de auditoría inválida: ${action}`);
    }

    // Sanitización estricta de anonimato para votación
    const isCastVote = action === AUDIT_ACTIONS.CAST_VOTE;
    const cleanActorId = isCastVote ? null : actorId;
    const cleanIpAddress = isCastVote ? null : ipAddress;
    const cleanMetadata = isCastVote ? this._sanitizeVoteMetadata(metadata) : metadata;

    // HMAC generado sobre el contenido del evento.
    // La base de datos asignará de forma determinista previous_hash y current_hash.
    const payloadToSign = `${action}:${cleanActorId || ''}:${electionId || ''}:${JSON.stringify(cleanMetadata)}`;
    const signature = this._signPayload(payloadToSign);

    try {
      return await auditRepository.createAuditLog({
        actorId: cleanActorId,
        electionId,
        action,
        ipAddress: cleanIpAddress,
        metadata: cleanMetadata,
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

  _sanitizeVoteMetadata(metadata) {
    const { voter_email, voter_name, ip, user_id, ...safeMetadata } = metadata;
    return safeMetadata;
  }

  /**
   * ONE-TIME TOKENS - SERVICIOS
   */

  async createOneTimeToken(tokenData) {
    const { userId, electionId, expiresAt } = tokenData;

    try {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      // Inserción directa delegando la atomicidad al índice único de la BD
      const tokenRecord = await auditRepository.createOneTimeToken({
        tokenHash,
        userId,
        electionId,
        expiresAt
      });

      return {
        token: rawToken,
        tokenRecord: {
          id: tokenRecord.id,
          userId: tokenRecord.userId,
          electionId: tokenRecord.electionId,
          expiresAt: tokenRecord.expiresAt,
          createdAt: tokenRecord.createdAt
        }
      };
    } catch (error) {
      if (error.code === 'P2002' || error.message?.includes('uq_vat_user_election_active')) {
        throw new Error('Ya existe un token activo para este usuario y elección');
      }
      console.error('Error al crear one-time token:', error);
      throw error;
    }
  }

  async consumeOneTimeToken(rawToken, electionId) {
    if (!rawToken || !electionId) {
      throw new Error('Token y electionId son requeridos');
    }

    try {
      // Procedimiento almacenado atómico
      const userId = await auditRepository.consumeTokenSQL(rawToken, electionId);

      if (!userId) {
        throw new Error('Token inválido o ya utilizado');
      }

      await this.logAction({
        action: AUDIT_ACTIONS.CAST_VOTE,
        electionId,
        actorId: null,
        ipAddress: null,
        metadata: {
          tokenConsumed: true
        }
      });

      return { userId };
    } catch (error) {
      if (error.message.includes('Token') || error.message.includes('token')) {
        throw error;
      }
      console.error('Error al consumir token:', error);
      throw new Error('No se pudo validar el token');
    }
  }

  async checkTokenStatus(rawToken, electionId) {
    try {
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      const token = await auditRepository.findTokenByHashReadOnly(tokenHash, electionId);

      if (!token) {
        return { exists: false, status: 'NOT_FOUND' };
      }

      if (token.usedAt) {
        return { exists: true, status: 'USED', usedAt: token.usedAt };
      }

      if (new Date(token.expiresAt) <= new Date()) {
        return { exists: true, status: 'EXPIRED', expiresAt: token.expiresAt };
      }

      return {
        exists: true,
        status: 'ACTIVE',
        electionId: token.electionId,
        createdAt: token.createdAt,
        expiresAt: token.expiresAt
      };
    } catch (error) {
      console.error('Error al verificar token:', error);
      throw new Error('No se pudo verificar el estado del token');
    }
  }

  async cleanupExpiredTokens() {
    try {
      const deletedCount = await auditRepository.deleteExpiredTokens();
      return { deletedCount };
    } catch (error) {
      console.error('Error en limpieza de tokens:', error);
      throw new Error('No se pudieron limpiar los tokens expirados');
    }
  }
}

export default new AuditService();