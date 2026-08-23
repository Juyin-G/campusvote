import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false
});

class AuditRepository {
  /**
   * UTILIDAD PARA TRANSACCIONES
   * Permite obtener un cliente asignado del pool para operaciones transaccionales.
   */
  async getTransaction() {
    const client = await pool.connect();
    return client;
  }

  /**
   * CONSULTAS DE AUDIT LOGS
   */

  // Obtener logs con filtros y paginación (Paralelizado)
  async findAuditLogs(filters = {}) {
    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const whereClauses = [];
    const values = [];
    let paramIndex = 1;

    if (filters.action) {
      whereClauses.push(`action = $${paramIndex++}`);
      values.push(filters.action);
    }
    if (filters.electionId) {
      whereClauses.push(`election_id = $${paramIndex++}`);
      values.push(filters.electionId);
    }
    if (filters.actorId) {
      whereClauses.push(`actor_id = $${paramIndex++}`);
      values.push(filters.actorId);
    }
    if (filters.fromDate) {
      whereClauses.push(`timestamp >= $${paramIndex++}`);
      values.push(filters.fromDate);
    }
    if (filters.toDate) {
      whereClauses.push(`timestamp <= $${paramIndex++}`);
      values.push(filters.toDate);
    }

    const whereClause = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT id, actor_id as "actorId", election_id as "electionId", action,
             timestamp, ip_address as "ipAddress", metadata,
             previous_hash as "previousHash", current_hash as "currentHash", signature
      FROM audit_logs
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const countQuery = `SELECT COUNT(*) FROM audit_logs ${whereClause}`;

    const [result, countResult] = await Promise.all([
      pool.query(query, [...values, limit, offset]),
      pool.query(countQuery, values)
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    return {
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Obtener un log específico por ID
  async findAuditLogById(id) {
    const query = `
      SELECT 
        id,
        actor_id as "actorId",
        election_id as "electionId",
        action,
        timestamp,
        ip_address as "ipAddress",
        metadata,
        previous_hash as "previousHash",
        current_hash as "currentHash",
        signature
      FROM audit_logs
      WHERE id = $1
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * CREACIÓN DE AUDIT LOGS
   */

  async createAuditLog(logData, client = null) {
    const {
      actorId,
      electionId,
      action,
      ipAddress,
      metadata = {},
      previousHash = '',
      currentHash = '',
      signature = ''
    } = logData;

    const query = `
      INSERT INTO audit_logs (
        actor_id,
        election_id,
        action,
        ip_address,
        metadata,
        previous_hash,
        current_hash,
        signature
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING 
        id,
        actor_id as "actorId",
        election_id as "electionId",
        action,
        timestamp,
        ip_address as "ipAddress",
        metadata,
        previous_hash as "previousHash",
        current_hash as "currentHash",
        signature
    `;

    const values = [
      actorId || null,
      electionId || null,
      action,
      ipAddress || null,
      JSON.stringify(metadata),
      previousHash,
      currentHash,
      signature
    ];

    const executor = client || pool;
    const result = await executor.query(query, values);
    return result.rows[0];
  }

  /**
   * ONE-TIME TOKENS
   */

  async createOneTimeToken(tokenData, client = null) {
    const { tokenHash, userId, electionId, expiresAt } = tokenData;

    const query = `
      INSERT INTO one_time_tokens (
        token_hash, user_id, election_id, expires_at
      ) VALUES ($1, $2, $3, $4)
      RETURNING 
        id,
        token_hash as "tokenHash",
        user_id as "userId",
        election_id as "electionId",
        created_at as "createdAt",
        expires_at as "expiresAt",
        used_at as "usedAt"
    `;

    const values = [tokenHash, userId, electionId, expiresAt];
    const executor = client || pool;
    const result = await executor.query(query, values);
    return result.rows[0];
  }

  // Buscar token por hash (Requiere transacción activa con bloqueo FOR UPDATE)
  async findOneTimeTokenByHash(tokenHash, electionId, client = null) {
    if (!client) {
      throw new Error('findOneTimeTokenByHash requiere un cliente en transacción para FOR UPDATE');
    }

    const query = `
      SELECT id, token_hash as "tokenHash", user_id as "userId",
             election_id as "electionId", created_at as "createdAt",
             expires_at as "expiresAt", used_at as "usedAt"
      FROM one_time_tokens
      WHERE token_hash = $1 AND election_id = $2
      FOR UPDATE
    `;

    const result = await client.query(query, [tokenHash, electionId]);
    return result.rows[0] || null;
  }

  // Buscar token por hash en modo lectura (Sin FOR UPDATE)
  async findTokenByHashReadOnly(tokenHash, electionId) {
    const query = `
      SELECT id, token_hash as "tokenHash", user_id as "userId",
             election_id as "electionId", created_at as "createdAt",
             expires_at as "expiresAt", used_at as "usedAt"
      FROM one_time_tokens
      WHERE token_hash = $1 AND election_id = $2
    `;

    const result = await pool.query(query, [tokenHash, electionId]);
    return result.rows[0] || null;
  }

  // Consumir token (Atómico)
  async consumeOneTimeToken(tokenHash, electionId, client = null) {
    const query = `
      UPDATE one_time_tokens
      SET used_at = CURRENT_TIMESTAMP
      WHERE token_hash = $1 
        AND election_id = $2 
        AND used_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP
      RETURNING 
        id,
        user_id as "userId",
        token_hash as "tokenHash"
    `;

    const executor = client || pool;
    const result = await executor.query(query, [tokenHash, electionId]);
    return result.rows[0] || null;
  }

  // Consumir token directo procesando el hash plano (Soporte directo a AuditService)
  async consumeTokenSQL(rawToken, electionId, client = null) {
    const { createHash } = await import('crypto');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const consumed = await this.consumeOneTimeToken(tokenHash, electionId, client);
    return consumed ? consumed.userId : null;
  }

  async findActiveToken(userId, electionId) {
    const query = `
      SELECT 
        id,
        token_hash as "tokenHash",
        user_id as "userId",
        election_id as "electionId",
        created_at as "createdAt",
        expires_at as "expiresAt",
        used_at as "usedAt"
      FROM one_time_tokens
      WHERE user_id = $1 
        AND election_id = $2 
        AND used_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP
    `;

    const result = await pool.query(query, [userId, electionId]);
    return result.rows[0] || null;
  }

  // Limpieza de todos los tokens vencidos
  async deleteExpiredTokens() {
    const query = `
      DELETE FROM one_time_tokens
      WHERE expires_at < CURRENT_TIMESTAMP
    `;

    const result = await pool.query(query);
    return result.rowCount;
  }

  async close() {
    await pool.end();
  }
}

export default new AuditRepository();