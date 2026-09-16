// tests/unit/fairs/fair.superadmin-authorization.test.js
// PASO 8.2 — Verifica que SUPERADMIN NO tiene acceso operativo a ninguno de
// los 7 módulos de FERIA, incluso si su registro tuviera organizationId.
//
// La verificación se hace en dos niveles:
//   1. CONSTANTES DE RUTA: los arrays MANAGERS / READERS / REVIEWERS de los
//      routers de ferias NO deben contener ROLES.SUPERADMIN.
//   2. MIDDLEWARE authorize() (cargado perezo con JWT_SECRET ya seteado).
//
// Estos tests son la contraparte "mínima" para demostrar el contrato de
// autorización definido por el PASO 8.2. NO tocan PostgreSQL.

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROLES } from '../../../src/constants/roles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readRouter = (rel) =>
  fs.readFile(path.resolve(__dirname, '../../../src/modules', rel), 'utf8');

// JWT_SECRET debe existir antes de cargar auth.middleware (lo importa de env).
// Este test no usa JWT real, pero el módulo `env` falla si no está seteado.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-jwt-secret-for-superadmin-auth';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

let authorize;
before(async () => {
  ({ authorize } = await import('../../../src/middlewares/auth.middleware.js'));
});

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

const fakeReq = (role, organizationId = null, extra = {}) => ({
  user: { role, organizationId, ...extra },
});

const fakeRes = () => ({});

// ──────────────────────────────────────────────────────────────────────
// 1. authorize([ROLES.ADMIN]) — el guard que usa cada router de feria
// ──────────────────────────────────────────────────────────────────────

describe('authorize([ADMIN]) — guard de los routers de feria', () => {
  it('ADMIN → next() sin error', () => {
    let nextErr = null;
    let nextCalled = false;
    authorize([ROLES.ADMIN])(
      fakeReq(ROLES.ADMIN),
      fakeRes(),
      (err) => {
        nextCalled = true;
        nextErr = err;
      }
    );
    assert.equal(nextCalled, true);
    assert.equal(nextErr, undefined);
  });

  it('SUPERADMIN → ApiError.forbidden 403', () => {
    let nextErr = null;
    let nextCalled = false;
    authorize([ROLES.ADMIN])(
      fakeReq(ROLES.SUPERADMIN),
      fakeRes(),
      (err) => {
        nextCalled = true;
        nextErr = err;
      }
    );
    assert.equal(nextCalled, true);
    assert.ok(nextErr, 'middleware debe invocar next(err)');
    assert.equal(nextErr.statusCode, 403);
    assert.match(nextErr.message, /permisos/i);
  });

  it('SUPERADMIN CON organizationId → 403 (organizationId no convierte al actor en ADMIN)', () => {
    let nextErr = null;
    authorize([ROLES.ADMIN])(
      fakeReq(ROLES.SUPERADMIN, '00000000-0000-4000-8000-00000000000a'),
      fakeRes(),
      (err) => {
        nextErr = err;
      }
    );
    assert.ok(nextErr);
    assert.equal(nextErr.statusCode, 403);
  });

  it('STUDENT → 403', () => {
    let nextErr = null;
    authorize([ROLES.ADMIN])(fakeReq(ROLES.STUDENT), fakeRes(), (err) => {
      nextErr = err;
    });
    assert.equal(nextErr?.statusCode, 403);
  });

  it('TEACHER → 403', () => {
    let nextErr = null;
    authorize([ROLES.ADMIN])(fakeReq(ROLES.TEACHER), fakeRes(), (err) => {
      nextErr = err;
    });
    assert.equal(nextErr?.statusCode, 403);
  });

  it('JURY → 403', () => {
    let nextErr = null;
    authorize([ROLES.ADMIN])(fakeReq(ROLES.JURY), fakeRes(), (err) => {
      nextErr = err;
    });
    assert.equal(nextErr?.statusCode, 403);
  });

  it('STUDENT (rol no autorizado) → 403', () => {
    let nextErr = null;
    authorize([ROLES.ADMIN])(fakeReq(ROLES.STUDENT), fakeRes(), (err) => {
      nextErr = err;
    });
    assert.equal(nextErr?.statusCode, 403);
  });
});

// ──────────────────────────────────────────────────────────────────────
// 2. authorize([ADMIN, JURY]) — guard READERS de fairEvaluations / fairCategories / fairStands
// ──────────────────────────────────────────────────────────────────────

describe('authorize([ADMIN, JURY]) — guard READERS de rúbrica/categorías/stands', () => {
  it('ADMIN → next()', () => {
    let nextErr = null;
    authorize([ROLES.ADMIN, ROLES.JURY])(fakeReq(ROLES.ADMIN), fakeRes(), (err) => {
      nextErr = err;
    });
    assert.equal(nextErr, undefined);
  });

  it('JURY → next()', () => {
    let nextErr = null;
    authorize([ROLES.ADMIN, ROLES.JURY])(fakeReq(ROLES.JURY), fakeRes(), (err) => {
      nextErr = err;
    });
    assert.equal(nextErr, undefined);
  });

  it('SUPERADMIN → 403 (NO forma parte de READERS)', () => {
    let nextErr = null;
    authorize([ROLES.ADMIN, ROLES.JURY])(fakeReq(ROLES.SUPERADMIN), fakeRes(), (err) => {
      nextErr = err;
    });
    assert.equal(nextErr?.statusCode, 403);
  });
});

// ──────────────────────────────────────────────────────────────────────
// 3. Inspección de constantes: SUPERADMIN NO está en los arrays de roles
//    de los 7 routers de feria.
// ──────────────────────────────────────────────────────────────────────

describe('Constantes de los routers de feria — SUPERADMIN ausente', () => {
  const expectsForbiddenPair = (routerRel, varName) =>
    `router ${routerRel} debe usar ${varName} sin SUPERADMIN`;

  it('fairs/fair.routes.js → MANAGERS = [ROLES.ADMIN] (sin SUPERADMIN)', async () => {
    const src = await readRouter('fairs/fair.routes.js');
    assert.match(
      src,
      /const\s+MANAGERS\s*=\s*\[\s*ROLES\.ADMIN\s*\]/,
      expectsForbiddenPair('fairs/fair.routes.js', 'MANAGERS')
    );
    assert.doesNotMatch(
      src,
      /MANAGERS\s*=\s*\[[^\]]*ROLES\.SUPERADMIN/,
      'fairs NO debe incluir SUPERADMIN en MANAGERS'
    );
  });

  it('projects/project.routes.js → REVIEWERS = [ROLES.ADMIN] (sin SUPERADMIN)', async () => {
    const src = await readRouter('projects/project.routes.js');
    assert.match(
      src,
      /const\s+REVIEWERS\s*=\s*\[\s*ROLES\.ADMIN\s*\]/,
      'project REVIEWERS debe ser [ROLES.ADMIN]'
    );
    assert.doesNotMatch(
      src,
      /REVIEWERS\s*=\s*\[[^\]]*ROLES\.SUPERADMIN/,
      'project REVIEWERS NO debe incluir SUPERADMIN'
    );
  });

  it('fairResults/fairResult.routes.js → MANAGERS = [ROLES.ADMIN] (sin SUPERADMIN)', async () => {
    const src = await readRouter('fairResults/fairResult.routes.js');
    assert.match(
      src,
      /const\s+MANAGERS\s*=\s*\[\s*ROLES\.ADMIN\s*\]/,
      'fairResult MANAGERS debe ser [ROLES.ADMIN]'
    );
    assert.doesNotMatch(
      src,
      /MANAGERS\s*=\s*\[[^\]]*ROLES\.SUPERADMIN/,
      'fairResult NO debe incluir SUPERADMIN en MANAGERS'
    );
  });

  it('juryAssignments/juryAssignment.routes.js → MANAGERS = [ROLES.ADMIN] (sin SUPERADMIN)', async () => {
    const src = await readRouter('juryAssignments/juryAssignment.routes.js');
    assert.match(
      src,
      /const\s+MANAGERS\s*=\s*\[\s*ROLES\.ADMIN\s*\]/,
      'juryAssignment MANAGERS debe ser [ROLES.ADMIN]'
    );
    assert.doesNotMatch(
      src,
      /MANAGERS\s*=\s*\[[^\]]*ROLES\.SUPERADMIN/,
      'juryAssignment NO debe incluir SUPERADMIN en MANAGERS'
    );
  });

  it('fairEvaluations/fairEvaluation.routes.js → MANAGERS y READERS sin SUPERADMIN', async () => {
    const src = await readRouter('fairEvaluations/fairEvaluation.routes.js');
    assert.match(
      src,
      /const\s+MANAGERS\s*=\s*\[\s*ROLES\.ADMIN\s*\]/,
      'fairEval MANAGERS debe ser [ROLES.ADMIN]'
    );
    assert.match(
      src,
      /const\s+READERS\s*=\s*\[\s*ROLES\.ADMIN\s*,\s*ROLES\.JURY\s*\]/,
      'fairEval READERS debe ser [ROLES.ADMIN, ROLES.JURY]'
    );
    assert.doesNotMatch(
      src,
      /(MANAGERS|READERS)\s*=\s*\[[^\]]*ROLES\.SUPERADMIN/,
      'fairEval NO debe incluir SUPERADMIN en MANAGERS ni READERS'
    );
  });

  it('fairCategories/fairCategory.routes.js → MANAGERS y READERS sin SUPERADMIN', async () => {
    const src = await readRouter('fairCategories/fairCategory.routes.js');
    assert.match(
      src,
      /const\s+MANAGERS\s*=\s*\[\s*ROLES\.ADMIN\s*\]/,
      'fairCategory MANAGERS debe ser [ROLES.ADMIN]'
    );
    assert.match(
      src,
      /const\s+READERS\s*=\s*\[\s*ROLES\.ADMIN\s*,\s*ROLES\.JURY\s*\]/,
      'fairCategory READERS debe ser [ROLES.ADMIN, ROLES.JURY]'
    );
    assert.doesNotMatch(
      src,
      /(MANAGERS|READERS)\s*=\s*\[[^\]]*ROLES\.SUPERADMIN/,
      'fairCategory NO debe incluir SUPERADMIN'
    );
  });

  it('fairStands/fairStand.routes.js → MANAGERS y READERS sin SUPERADMIN', async () => {
    const src = await readRouter('fairStands/fairStand.routes.js');
    assert.match(
      src,
      /const\s+MANAGERS\s*=\s*\[\s*ROLES\.ADMIN\s*\]/,
      'fairStand MANAGERS debe ser [ROLES.ADMIN]'
    );
    assert.match(
      src,
      /const\s+READERS\s*=\s*\[\s*ROLES\.ADMIN\s*,\s*ROLES\.JURY\s*\]/,
      'fairStand READERS debe ser [ROLES.ADMIN, ROLES.JURY]'
    );
    assert.doesNotMatch(
      src,
      /(MANAGERS|READERS)\s*=\s*\[[^\]]*ROLES\.SUPERADMIN/,
      'fairStand NO debe incluir SUPERADMIN'
    );
  });
});

// ──────────────────────────────────────────────────────────────────────
// 4. projects/project.service.js — REVIEWER_ROLES = [ROLES.ADMIN]
// ──────────────────────────────────────────────────────────────────────

describe('projects/project.service.js — REVIEWER_ROLES = [ROLES.ADMIN]', () => {
  it('REVIEWER_ROLES ya no incluye SUPERADMIN', async () => {
    const src = await readRouter('projects/project.service.js');
    assert.match(
      src,
      /const\s+REVIEWER_ROLES\s*=\s*\[\s*ROLES\.ADMIN\s*\]/,
      'REVIEWER_ROLES debe ser [ROLES.ADMIN]'
    );
    assert.doesNotMatch(
      src,
      /REVIEWER_ROLES\s*=\s*\[[^\]]*ROLES\.SUPERADMIN/,
      'REVIEWER_ROLES NO debe incluir SUPERADMIN'
    );
  });

  it('reviewProject rechaza SUPERADMIN con ApiError.forbidden', async () => {
    // Carga perezosa: requiere prisma. Como aquí solo necesitamos la rama
    // previa al tenant check (REVIEWER_ROLES), basta con verificar el helper
    // puro. Se importa dinámicamente para evitar tocar BD al cargar tests.
    const { reviewProject } = await import('../../../src/modules/projects/project.service.js');
    let captured = null;
    try {
      await reviewProject({
        projectId: 'p1',
        data: { decision: 'APPROVED' },
        actor: { id: 's1', role: ROLES.SUPERADMIN, organizationId: 'orgA' },
      });
    } catch (err) {
      captured = err;
    }
    assert.ok(captured, 'reviewProject debe lanzar error');
    assert.equal(captured.statusCode || captured.status, 403);
    assert.match(captured.message || '', /administrador/i);
  });
});

// ──────────────────────────────────────────────────────────────────────
// 5. ADMIN cross-tenant — servicios de feria
// ──────────────────────────────────────────────────────────────────────

describe('ADMIN cross-tenant — servicios de feria', () => {
  const ORG_A = '00000000-0000-4000-8000-00000000000a';
  const ORG_B = '00000000-0000-4000-8000-000000000b01';

  for (const rel of [
    'fairs/fair.service.js',
    'projects/project.service.js',
    'fairResults/fairResult.service.js',
    'juryAssignments/juryAssignment.service.js',
    'fairEvaluations/fairEvaluation.service.js',
    'fairCategories/fairCategory.service.js',
    'fairStands/fairStand.service.js',
  ]) {
    it(`${rel} NO contiene isSuperAdmin (helper de bypass eliminado)`, async () => {
      const src = await readRouter(rel);
      assert.doesNotMatch(
        src,
        /const\s+isSuperAdmin\s*=/,
        `${rel} debe haber eliminado el helper isSuperAdmin`
      );
      assert.doesNotMatch(
        src,
        /if\s*\(\s*isSuperAdmin\(actor\)\s*\)\s*return/,
        `${rel} no debe tener bypass if(isSuperAdmin(actor)) return`
      );
    });
  }
});

// ──────────────────────────────────────────────────────────────────────
// 6. Certificate — regla ya validada por certificate.authorization.test.js
//    Se referencia acá para constancia explícita.
// ──────────────────────────────────────────────────────────────────────

describe('certificate (sin cambios — ya validado por certificate.authorization.test.js)', () => {
  it('certificate.routes.js usa ADMIN_ONLY = [ROLES.ADMIN]', async () => {
    const src = await readRouter('certificate/certificate.routes.js');
    assert.match(
      src,
      /const\s+ADMIN_ONLY\s*=\s*\[\s*ROLES\.ADMIN\s*\]/,
      'certificate ADMIN_ONLY debe ser [ROLES.ADMIN]'
    );
    assert.doesNotMatch(
      src,
      /ADMIN_ONLY\s*=\s*\[[^\]]*ROLES\.SUPERADMIN/,
      'certificate ADMIN_ONLY NO debe incluir SUPERADMIN'
    );
  });
});
