// tests/unit/certificate/certificate.authorization.test.js
// Pruebas unitarias de las REGLAS DE AUTORIZACIÓN del módulo de
// certificados. Estas pruebas validan las funciones PURAS del service
// (canGenerateCertificates, assertAdminTenantForFairPure,
// canAdminReadOthersCertificate, assertOfficialPublicationPure) y la
// clasificación de miembros.
//
// Las pruebas de integración HTTP + BD que cubren el flujo completo
// (endpoints con autenticación, JWT, BD real) requieren PostgreSQL
// real y están PENDIENTES de implementación en
// tests/integration/certificate.integration.test.js (ver nota al final).

import assert from 'node:assert/strict';

import { ROLES } from '../../../src/constants/roles.js';

import {
  canGenerateCertificates,
  assertAdminTenantForFairPure,
  canAdminReadOthersCertificate,
  assertOfficialPublicationPure,
  filterValidMembers,
  classifyMembers,
} from '../../../src/modules/certificate/certificate.service.js';

const ORG_A = '00000000-0000-4000-8000-00000000000a';
const ORG_B = '00000000-0000-4000-8000-000000000b01';
const FAIR_A = '00000000-0000-4000-8000-000000c01a';
const FAIR_B = '00000000-0000-4000-8000-000000c02b';

const adminA = () => ({ id: 'a1', role: ROLES.ADMIN, organizationId: ORG_A });
const adminB = () => ({ id: 'b1', role: ROLES.ADMIN, organizationId: ORG_B });
const superAdmin = () => ({ id: 's1', role: ROLES.SUPERADMIN, organizationId: null });
const superAdminWithOrg = () => ({
  id: 's2',
  role: ROLES.SUPERADMIN,
  organizationId: ORG_A,
});
const student = () => ({ id: 'st1', role: ROLES.STUDENT, organizationId: ORG_A });
const teacher = () => ({ id: 't1', role: ROLES.TEACHER, organizationId: ORG_A });
const jury = () => ({ id: 'j1', role: ROLES.JURY, organizationId: ORG_A });

const fairA = (status = 'CLOSED') => ({ id: FAIR_A, organizationId: ORG_A, status });
const fairB = (status = 'CLOSED') => ({ id: FAIR_B, organizationId: ORG_B, status });

const certOfOrgA = (overrides = {}) => ({
  id: 'cert-1',
  userId: 'u1',
  projectId: 'p1',
  fairId: FAIR_A,
  certificateType: 'PARTICIPATION',
  fair: { id: FAIR_A, organizationId: ORG_A },
  ...overrides,
});

// ────────────────────────────────────────────────────────────────────
describe('canGenerateCertificates', () => {
  it('ADMIN de cualquier organización → true', () => {
    assert.equal(canGenerateCertificates(adminA()), true);
    assert.equal(canGenerateCertificates(adminB()), true);
  });

  it('SUPERADMIN → false (sin bypass operativo del tenant)', () => {
    assert.equal(canGenerateCertificates(superAdmin()), false);
    assert.equal(canGenerateCertificates(superAdminWithOrg()), false);
  });

  it('STUDENT → false', () => {
    assert.equal(canGenerateCertificates(student()), false);
  });

  it('TEACHER → false', () => {
    assert.equal(canGenerateCertificates(teacher()), false);
  });

  it('JURY → false', () => {
    assert.equal(canGenerateCertificates(jury()), false);
  });
});

// ────────────────────────────────────────────────────────────────────
describe('assertAdminTenantForFairPure', () => {
  it('ADMIN de la organización de la feria → sin error', () => {
    const err = assertAdminTenantForFairPure({ fair: fairA(), actor: adminA() });
    assert.equal(err, null);
  });

  it('ADMIN de OTRA organización → 403 string', () => {
    const err = assertAdminTenantForFairPure({ fair: fairA(), actor: adminB() });
    assert.ok(err);
    assert.match(err, /organizaci[oó]n/);
  });

  it('SUPERADMIN (incluso con organizationId) → 403 string (sin bypass)', () => {
    const err = assertAdminTenantForFairPure({
      fair: fairA(),
      actor: superAdminWithOrg(),
    });
    assert.ok(err);
    assert.match(err, /ADMIN/);
  });

  it('SUPERADMIN sin organización → 403 string', () => {
    const err = assertAdminTenantForFairPure({
      fair: fairA(),
      actor: superAdmin(),
    });
    assert.ok(err);
    assert.match(err, /ADMIN/);
  });

  it('STUDENT / TEACHER / JURY → 403 string', () => {
    for (const actor of [student(), teacher(), jury()]) {
      const err = assertAdminTenantForFairPure({ fair: fairA(), actor });
      assert.ok(err, `actor=${actor.role} debería fallar`);
      assert.match(err, /ADMIN/);
    }
  });

  it('ADMIN sin organizationId → 403 string', () => {
    const actor = { id: 'x', role: ROLES.ADMIN, organizationId: null };
    const err = assertAdminTenantForFairPure({ fair: fairA(), actor });
    assert.ok(err);
    assert.match(err, /organizaci[oó]n/);
  });
});

// ────────────────────────────────────────────────────────────────────
describe('canAdminReadOthersCertificate', () => {
  it('ADMIN de la misma organización que la feria del certificado → true', () => {
    assert.equal(
      canAdminReadOthersCertificate({
        cert: certOfOrgA(),
        actor: adminA(),
      }),
      true
    );
  });

  it('ADMIN de OTRA organización → false', () => {
    assert.equal(
      canAdminReadOthersCertificate({
        cert: certOfOrgA(),
        actor: adminB(),
      }),
      false
    );
  });

  it('SUPERADMIN (incluso con organizationId) → false (sin bypass)', () => {
    assert.equal(
      canAdminReadOthersCertificate({
        cert: certOfOrgA(),
        actor: superAdminWithOrg(),
      }),
      false
    );
    assert.equal(
      canAdminReadOthersCertificate({
        cert: certOfOrgA(),
        actor: superAdmin(),
      }),
      false
    );
  });

  it('STUDENT / TEACHER / JURY → false', () => {
    for (const actor of [student(), teacher(), jury()]) {
      assert.equal(
        canAdminReadOthersCertificate({ cert: certOfOrgA(), actor }),
        false,
        `actor=${actor.role} no debería leer certificados ajenos`
      );
    }
  });
});

// ────────────────────────────────────────────────────────────────────
describe('assertOfficialPublicationPure', () => {
  it('CLOSED + publicación → null (sin error)', () => {
    const err = assertOfficialPublicationPure({
      fair: fairA('CLOSED'),
      publication: { id: 'pub-1', fairId: FAIR_A },
    });
    assert.equal(err, null);
  });

  it('CLOSED sin publicación → mensaje de error', () => {
    const err = assertOfficialPublicationPure({
      fair: fairA('CLOSED'),
      publication: null,
    });
    assert.ok(err);
    assert.match(err, /publicaci[oó]n/);
  });

  it('OPEN con publicación → mensaje de error (CLOSED es obligatorio)', () => {
    const err = assertOfficialPublicationPure({
      fair: fairA('OPEN'),
      publication: { id: 'pub-1', fairId: FAIR_A },
    });
    assert.ok(err);
    assert.match(err, /CLOSED/);
  });

  it('DRAFT con publicación → mensaje de error', () => {
    const err = assertOfficialPublicationPure({
      fair: fairA('DRAFT'),
      publication: { id: 'pub-1', fairId: FAIR_A },
    });
    assert.ok(err);
    assert.match(err, /CLOSED/);
  });

  it('DRAFT sin publicación → mensaje de error', () => {
    const err = assertOfficialPublicationPure({
      fair: fairA('DRAFT'),
      publication: null,
    });
    assert.ok(err);
    assert.match(err, /CLOSED/);
  });
});

// ────────────────────────────────────────────────────────────────────
describe('Reglas de clasificación (PARTICIPATION / WINNER)', () => {
  const m = (userId, role = 'EXPOSITOR') => ({
    id: `m-${userId}`,
    projectId: 'p1',
    userId,
    role,
    createdAt: new Date('2026-01-01'),
  });

  it('proyecto NO ganador → solo PARTICIPATION', () => {
    const out = classifyMembers({
      members: [m('u1'), m('u2'), m('u3')],
      winnerProjectId: 'other-project',
      projectId: 'p1',
    });
    assert.deepEqual(out.participation, ['u1', 'u2', 'u3']);
    assert.deepEqual(out.winner, []);
  });

  it('proyecto ganador → PARTICIPATION Y WINNER para los mismos miembros', () => {
    const out = classifyMembers({
      members: [m('u1'), m('u2'), m('u3')],
      winnerProjectId: 'p1',
      projectId: 'p1',
    });
    assert.deepEqual(out.participation, ['u1', 'u2', 'u3']);
    assert.deepEqual(out.winner, ['u1', 'u2', 'u3']);
  });

  it('winnerProjectId=null → winner siempre vacío', () => {
    const out = classifyMembers({
      members: [m('u1')],
      winnerProjectId: null,
      projectId: 'p1',
    });
    assert.deepEqual(out.winner, []);
    assert.deepEqual(out.participation, ['u1']);
  });

  it('deduplica miembros por userId (un usuario una sola fila)', () => {
    const out = classifyMembers({
      members: [m('u1', 'EXPOSITOR'), m('u1', 'COLLABORATOR'), m('u2', 'ADVISOR')],
      winnerProjectId: 'p1',
      projectId: 'p1',
    });
    assert.equal(out.participation.length, 2);
    assert.equal(out.winner.length, 2);
  });
});

// ────────────────────────────────────────────────────────────────────
describe('Reglas de unicidad (UNIQUE a nivel BD)', () => {
  it('el UNIQUE a nivel de Prisma/SQL está declarado en certificate.prisma', async () => {
    // Esta prueba verifica la convención declarada en el schema
    // Prisma (debe estar sincronizado con la migración SQL). Si esto
    // cambia, también debe cambiarse la migración.
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const schemaPath = path.resolve(
      __dirname,
      '../../../prisma/schema/certificate.prisma'
    );
    const sqlPath = path.resolve(
      __dirname,
      '../../../database/sql/fairs/011_certificates.sql'
    );

    const schema = await fs.readFile(schemaPath, 'utf8');
    const sql = await fs.readFile(sqlPath, 'utf8');

    // Prisma: unique sobre (fairId, projectId, userId, certificateType).
    assert.match(schema, /@@unique\(\[fairId, projectId, userId, certificateType\]/);
    // SQL: uq_certificates_fair_project_user_type.
    assert.match(sql, /uq_certificates_fair_project_user_type/);
    assert.match(sql, /UNIQUE \(fair_id, project_id, user_id, certificate_type\)/);
  });
});