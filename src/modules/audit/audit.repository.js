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
   */
  async getTransaction() {
    return await pool.connect();
  }

  /**
   * CONSULTAS DE AUDIT LOGS
   */

  // CAMBIO: firma ahora acepta organizationId del actor. El filtro por
  // tenant se aplica a nivel SQL mediante JOIN contra users y contra
  // elections. Si no llega organizationId → 403 (defensa en profundidad).
  async findAuditLogs(filters = {}, organizationId = null) {
    if (!organizationId) {
      const err = new Error('Filtro de organización requerido para consultar auditoría');
      err.statusCode = 403;
      throw err;
    }

    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 20));
    const offset = (page - 1) * limit;

    // CAMBIO: whereClauses base con filtro obligatorio por organización.
    // Se aplica vía JOIN:
    //   (a) audit_logs.actor_id → users.organization_id = X
    //   (b) audit_logs.election_id → elections.organization_id = X
    //   (c) logs sin actor ni election (de plataforma) → EXCLUIDOS del tenant.
    const whereClauses = [
      `(u.organization_id = $${1}::uuid OR e.organization_id = $${1}::uuid)`
    ];
    const values = [organizationId];
    let paramIndex = 2;

    if (filters.action) {
      whereClauses.push(`a.action = $${paramIndex++}`);
      values.push(filters.action);
    }
    if (filters.electionId) {
      whereClauses.push(`a.election_id = $${paramIndex++}`);
      values.push(filters.electionId);
    }
    if (filters.actorId) {
      whereClauses.push(`a.actor_id = $${paramIndex++}`);
      values.push(filters.actorId);
    }
    if (filters.fromDate) {
      whereClauses.push(`a.timestamp >= $${paramIndex++}`);
      values.push(filters.fromDate);
    }
    if (filters.toDate) {
      whereClauses.push(`a.timestamp <= $${paramIndex++}`);
      values.push(filters.toDate);
    }

    const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

    const query = `
      SELECT a.id,
             a.sequence_num as "sequenceNum",
             a.actor_id as "actorId",
             a.election_id as "electionId",
             a.action,
             a.timestamp,
             a.ip_address as "ipAddress",
             a.metadata,
             a.previous_hash as "previousHash",
             a.current_hash as "currentHash",
             a.signature
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.actor_id
      LEFT JOIN elections e ON e.id = a.election_id
      ${whereClause}
      ORDER BY a.sequence_num DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) FROM audit_logs a
      LEFT JOIN users u ON u.id = a.actor_id
      LEFT JOIN elections e ON e.id = a.election_id
      ${whereClause}
    `;

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

  async findAuditLogById(id) {
    const query = `
      SELECT 
        id,
        sequence_num as "sequenceNum",
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
      signature = ''
    } = logData;

    // Los campos previous_hash y current_hash son calculados de forma determinista 
    // por el TRIGGER `trg_compute_audit_hash` en la BD.
    const query = `
      INSERT INTO audit_logs (
        actor_id,
        election_id,
        action,
        ip_address,
        metadata,
        signature
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING 
        id,
        sequence_num as "sequenceNum",
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
      signature
    ];

    const executor = client || pool;
    const result = await executor.query(query, values);
    return result.rows[0];
  }

  /**
   * VOTING ACCESS TOKENS
   */

  async createOneTimeToken(tokenData, client = null) {
    const { tokenHash, userId, electionId, expiresAt } = tokenData;

    const query = `
      INSERT INTO voting_access_tokens (
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

  async findTokenByHashReadOnly(tokenHash, electionId) {
    const query = `
      SELECT id, token_hash as "tokenHash", user_id as "userId",
             election_id as "electionId", created_at as "createdAt",
             expires_at as "expiresAt", used_at as "usedAt"
      FROM voting_access_tokens
      WHERE token_hash = $1 AND election_id = $2
    `;

    const result = await pool.query(query, [tokenHash, electionId]);
    return result.rows[0] || null;
  }

  // Invoca directamente la función atómica almacenada en PL/pgSQL
  async consumeTokenSQL(rawToken, electionId, client = null) {
    const query = `SELECT consume_voting_access_token($1, $2) as "userId"`;
    const executor = client || pool;
    const result = await executor.query(query, [rawToken, electionId]);
    return result.rows[0]?.userId || null;
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
      FROM voting_access_tokens
      WHERE user_id = $1 
        AND election_id = $2 
        AND used_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP
    `;

    const result = await pool.query(query, [userId, electionId]);
    return result.rows[0] || null;
  }

  async deleteExpiredTokens() {
    const query = `
      DELETE FROM voting_access_tokens
      WHERE expires_at < CURRENT_TIMESTAMP
    `;

    const result = await pool.query(query);
    return result.rowCount;
  }

  /**
   * Verifica la integridad de la cadena de hashes (función SQL
   * `verify_audit_chain()` de 003_audit_protection.sql).
   */
  async verifyAuditChain() {
    const query = `SELECT * FROM verify_audit_chain()`;
    const result = await pool.query(query);
    return result.rows[0] || null;
  }

  async close() {
    await pool.end();
  }
}

export default new AuditRepository();