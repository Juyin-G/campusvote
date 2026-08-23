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

    try {
      if (!Object.values(AUDIT_ACTIONS).includes(action)) {
        throw new Error(`Acción de auditoría inválida: ${action}`);
      }

      const lastLog = await this.getLastAuditLog();
      const previousHash = lastLog ? lastLog.currentHash : '';
      
      const currentContent = JSON.stringify({
        actorId,
        electionId,
        action,
        timestamp: new Date().toISOString(),
        ipAddress,
        metadata,
        previousHash
      });
      
      const currentHash = crypto
        .createHash('sha256')
        .update(currentContent)
        .digest('hex');

      const signature = this._signHash(currentHash);

      return await auditRepository.createAuditLog({
        actorId,
        electionId,
        action,
        ipAddress,
        metadata,
        previousHash,
        currentHash,
        signature
      });
    } catch (error) {
      console.error('Error al registrar audit log:', error);
      throw error;
    }
  }

  async getLastAuditLog() {
    const result = await auditRepository.findAuditLogs({ page: 1, limit: 1 });
    return result.data[0] || null;
  }

  _signHash(hash) {
    const secret = process.env.AUDIT_SECRET_KEY || 'default-secret';
    return crypto
      .createHash('sha256')
      .update(hash + secret)
      .digest('hex');
  }

  /**
   * ONE-TIME TOKENS - SERVICIOS
   */

  async createOneTimeToken(tokenData) {
    const { userId, electionId, expiresAt } = tokenData;

    try {
      const existingToken = await auditRepository.findActiveToken(userId, electionId);
      if (existingToken) {
        throw new Error('Ya existe un token activo para este usuario y elección');
      }

      const rawToken = crypto.randomBytes(32).toString('hex');
      
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

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
      console.error('Error al crear one-time token:', error);
      throw error;
    }
  }

  async consumeOneTimeToken(rawToken, electionId) {
    if (!rawToken || !electionId) {
      throw new Error('Token y electionId son requeridos');
    }

    try {
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
          tokenConsumed: true,
          timestamp: new Date().toISOString()
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
        userId: token.userId,
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