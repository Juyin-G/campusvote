/**
 * audit-immutability.integration.test.js
 * S7-12 — Verifica que audit_logs es inmutable a nivel de PostgreSQL.
 *
 * El test ataca directamente la tabla audit_logs en campusvote_test
 * y verifica que los triggers definidos en
 * database/sql/audit/003_audit_protection.sql rechazan UPDATE,
 * DELETE y TRUNCATE con el error lanzado por
 * prevent_audit_log_modification().
 *
 * NO se mockea auditService. Se prueba comportamiento real de la BD.
 */

const { prisma } = await import('../../src/database/prisma.js');

/**
 * Inserta un audit_log de prueba usando SQL nativo.
 * El modelo audit_logs no está definido en el schema Prisma, pero
 * la tabla existe en BD (cargada por tests/setup-db.js). Se usa
 * $executeRawUnsafe para evitar acoplar este test al módulo Audit.
 */
const insertSampleAuditLog = async () => {
  await prisma.$executeRawUnsafe(`
    INSERT INTO audit_logs (
      actor_id,
      election_id,
      action,
      ip_address,
      metadata,
      previous_hash,
      current_hash,
      signature
    ) VALUES (
      NULL,
      NULL,
      'LOGIN',
      NULL,
      '{}'::jsonb,
      '',
      '',
      -- chk_audit_signature_if_hash exige firma cuando hay hash, y un trigger
      -- calcula current_hash al insertar: la firma no puede ir vacía.
      'firma-de-prueba'
    )
  `);
  // $executeRawUnsafe devuelve el conteo de filas afectadas.
  // Para obtener el id, hacemos un SELECT adicional.
  const rows = await prisma.$queryRawUnsafe(
    'SELECT id FROM audit_logs ORDER BY timestamp DESC LIMIT 1;'
  );
  return rows[0]?.id ?? null;
};

describe('Audit Immutability Integration (BD real)', () => {
  let sampleAuditLogId = null;

  beforeAll(async () => {
    sampleAuditLogId = await insertSampleAuditLog();
  });

  afterAll(async () => {
    // No podemos DELETE (verificado abajo), pero $disconnect sí.
    await prisma.$disconnect();
  });

  // Mensaje exacto que lanza el trigger en 003_audit_protection.sql
  const PROTECTION_MESSAGE =
    'VIOLACIÓN DE SEGURIDAD: Los registros de auditoría son inmutables.';

  it('audit_logs rechaza UPDATE (protección SQL real)', async () => {
    let capturedError = null;
    try {
      // UPDATE válido para el tipo enum (LOGIN está en audit_action_type).
      // Si pasara el trigger, actualizaría 1 fila.
      await prisma.$executeRawUnsafe(
        `UPDATE audit_logs SET action = 'LOGIN' WHERE id = '${sampleAuditLogId}'::uuid;`
      );
    } catch (err) {
      capturedError = err;
    }

    expect(capturedError).not.toBeNull();
    expect(String(capturedError.message)).toContain(PROTECTION_MESSAGE);
  });

  it('audit_logs rechaza DELETE (protección SQL real)', async () => {
    let capturedError = null;
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM audit_logs WHERE id = '${sampleAuditLogId}'::uuid;`
      );
    } catch (err) {
      capturedError = err;
    }

    expect(capturedError).not.toBeNull();
    expect(String(capturedError.message)).toContain(PROTECTION_MESSAGE);
  });

  it('audit_logs rechaza TRUNCATE (protección SQL real)', async () => {
    let capturedError = null;
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE audit_logs;`);
    } catch (err) {
      capturedError = err;
    }

    expect(capturedError).not.toBeNull();
    expect(String(capturedError.message)).toContain(PROTECTION_MESSAGE);
  });

  it('UPDATE no afecta ninguna fila (estado inalterado)', async () => {
    // Después de los 3 tests anteriores, el audit_log de prueba
    // debe seguir existiendo intacto.
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, action FROM audit_logs WHERE id = '${sampleAuditLogId}'::uuid;`
    );
    expect(rows.length).toBe(1);
    expect(rows[0].action).toBe('LOGIN');
  });
});
