// tests/unit/middlewares/tenantScope.middleware.test.js
//
// Verifica el cumplimiento del requisito de CONTROL DE USUARIOS
// ACADÉMICOS a nivel de middleware:
//   - SUPERADMIN nunca debe pasar canActorActOnUser().
//   - ADMIN ORG tiene alcance total dentro de su organización.
//   - ADMIN REGION solo sobre usuarios cuyas siteAssignments caen en su región.
//   - ADMIN SITE solo sobre usuarios con siteAssignments en sus sedes.

import { jest } from '@jest/globals';

const mockActorHasSiteAccess = jest.fn();
const mockActorHasRegionAccess = jest.fn();

jest.unstable_mockModule('../../../src/services/adminScope.service.js', () => ({
  resolveAccessibleSites: jest.fn(),
  actorHasSiteAccess: mockActorHasSiteAccess,
  actorHasRegionAccess: mockActorHasRegionAccess,
  canCreateScope: jest.fn(),
  assignSiteScopes: jest.fn(),
}));

jest.unstable_mockModule('../../../src/database/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    organizationSite: {
      findMany: jest.fn(),
    },
  },
}));

const { canActorActOnUser, buildScopeUserWhere } = await import(
  '../../../src/middlewares/tenantScope.middleware.js'
);

describe('canActorActOnUser', () => {
  test('SUPERADMIN → siempre FORBIDDEN (defense in depth)', async () => {
    const superAdmin = { role: 'SUPERADMIN', organizationId: null };
    await expect(
      canActorActOnUser(superAdmin, 'org-1', ['site-1'])
    ).rejects.toThrow(/administrador de plataforma.*CRUD de usuarios de tenant/);
  });

  test('usuario no autenticado → FORBIDDEN', async () => {
    await expect(canActorActOnUser(null, 'org-1', [])).rejects.toThrow(/No autenticado/);
  });

  test('actor no ADMIN (e.g., STUDENT) → FORBIDDEN', async () => {
    const student = { role: 'STUDENT', organizationId: 'org-1' };
    await expect(canActorActOnUser(student, 'org-1', [])).rejects.toThrow(
      /Solo un administrador/
    );
  });

  test('target en otra organización → FORBIDDEN', async () => {
    const admin = { role: 'ADMIN', organizationId: 'org-1', scopeLevel: 'ORG' };
    await expect(canActorActOnUser(admin, 'org-2', [])).rejects.toThrow(
      /otra organización/
    );
  });

  test('ADMIN ORG sin scopeLevel → FORBIDDEN', async () => {
    const admin = { role: 'ADMIN', organizationId: 'org-1' };
    await expect(canActorActOnUser(admin, 'org-1', [])).rejects.toThrow(
      /scope configurado/
    );
  });

  test('ADMIN ORG con orgId coincidente → ALLOW', async () => {
    const admin = { role: 'ADMIN', organizationId: 'org-1', scopeLevel: 'ORG' };
    const result = await canActorActOnUser(admin, 'org-1', []);
    expect(result).toBe(true);
  });

  test('ADMIN REGION sin regionId → FORBIDDEN', async () => {
    const admin = {
      role: 'ADMIN',
      organizationId: 'org-1',
      scopeLevel: 'REGION',
    };
    await expect(canActorActOnUser(admin, 'org-1', [])).rejects.toThrow(
      /ADMIN REGION sin región/
    );
  });

  test('ADMIN REGION con usuario sin site → DENEGADO', async () => {
    const admin = {
      role: 'ADMIN',
      organizationId: 'org-1',
      scopeLevel: 'REGION',
      regionId: 'region-A',
    };
    const result = await canActorActOnUser(admin, 'org-1', []);
    expect(result).toBe(false);
  });

  test('ADMIN SITE con site assignment fuera de alcance → DENEGADO', async () => {
    const admin = {
      role: 'ADMIN',
      organizationId: 'org-1',
      scopeLevel: 'SITE',
      regionId: null,
    };
    // Su única sede asignada es site-X; el target tiene site-Y.
    const { resolveAccessibleSites } = await import(
      '../../../src/services/adminScope.service.js'
    );
    resolveAccessibleSites.mockResolvedValueOnce([{ siteId: 'site-X' }]);
    const result = await canActorActOnUser(admin, 'org-1', ['site-Y']);
    expect(result).toBe(false);
  });
});

describe('buildScopeUserWhere', () => {
  test('SUPERADMIN → FORBIDDEN (defense in depth)', async () => {
    await expect(
      buildScopeUserWhere({ role: 'SUPERADMIN', organizationId: null })
    ).rejects.toThrow(/administrador de plataforma/);
  });

  test('actor no autenticado → FORBIDDEN', async () => {
    await expect(buildScopeUserWhere(null)).rejects.toThrow(/administrador/);
  });

  test('actor no ADMIN → FORBIDDEN', async () => {
    await expect(
      buildScopeUserWhere({ role: 'STUDENT', organizationId: 'org-1' })
    ).rejects.toThrow(/Solo un administrador/);
  });

  test('ADMIN ORG → filtro por organizationId sin siteAssignments', async () => {
    const admin = { role: 'ADMIN', organizationId: 'org-1', scopeLevel: 'ORG' };
    const where = await buildScopeUserWhere(admin);
    expect(where.organizationId).toBe('org-1');
    expect(where.role).toEqual({ not: 'SUPERADMIN' });
    expect(where.siteAssignments).toBeUndefined();
  });

  test('ADMIN REGION sin regionId → FORBIDDEN', async () => {
    const admin = {
      role: 'ADMIN',
      organizationId: 'org-1',
      scopeLevel: 'REGION',
    };
    await expect(buildScopeUserWhere(admin)).rejects.toThrow(/sin región/);
  });

  test('ADMIN REGION → filtro con siteAssignments.some', async () => {
    const admin = {
      role: 'ADMIN',
      organizationId: 'org-1',
      scopeLevel: 'REGION',
      regionId: 'region-A',
    };
    const where = await buildScopeUserWhere(admin);
    expect(where.siteAssignments).toEqual({
      some: { site: { regionId: 'region-A' } },
    });
  });

  test('ADMIN SITE → filtro con siteId IN', async () => {
    const admin = {
      role: 'ADMIN',
      organizationId: 'org-1',
      scopeLevel: 'SITE',
      regionId: null,
    };
    const { resolveAccessibleSites } = await import(
      '../../../src/services/adminScope.service.js'
    );
    resolveAccessibleSites.mockResolvedValueOnce([
      { siteId: 'site-A' },
      { siteId: 'site-B' },
    ]);
    const where = await buildScopeUserWhere(admin);
    expect(where.siteAssignments).toEqual({
      some: { siteId: { in: ['site-A', 'site-B'] } },
    });
  });
});
