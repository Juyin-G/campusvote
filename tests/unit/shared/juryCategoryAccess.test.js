// tests/unit/shared/juryCategoryAccess.test.js
// Tests unitarios del helper central de autorización JURY → CATEGORY → PROJECT.

import { jest } from '@jest/globals';

const mockPrisma = {
  user: { findUnique: jest.fn() },
  fairJuryAssignment: { findFirst: jest.fn() },
  fair: { findUnique: jest.fn() },
  project: { findUnique: jest.fn() },
  fairJuryCategoryAssignment: { findMany: jest.fn(), count: jest.fn() },
};

jest.unstable_mockModule('../../../src/database/prisma.js', () => ({
  prisma: mockPrisma,
}));

const { assertJuryCanOperateOnProject, getJuryCategoryIds, assertJuryHasCategories } = await import(
  '../../../src/shared/helpers/juryCategoryAccess.js'
);

describe('juryCategoryAccess — assertJuryCanOperateOnProject', () => {
  beforeEach(() => jest.clearAllMocks());

  const baseActor = { id: 'jury-1', role: 'JURY' };

  it('lanza 403 si el actor no tiene rol JURY', async () => {
    await expect(
      assertJuryCanOperateOnProject({ fairId: 'f1', projectId: 'p1', actor: { id: 'u1', role: 'ADMIN' } })
    ).rejects.toThrow('Solo los usuarios con rol JURY');
  });

  it('lanza 403 si el usuario no está ACTIVE', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'jury-1', status: 'SUSPENDED', role: 'JURY', organizationId: 'org1' });
    await expect(
      assertJuryCanOperateOnProject({ fairId: 'f1', projectId: 'p1', actor: baseActor })
    ).rejects.toThrow('no está activo');
  });

  it('lanza 403 si no está asignado a la feria', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'jury-1', status: 'ACTIVE', role: 'JURY', organizationId: 'org1' });
    mockPrisma.fairJuryAssignment.findFirst.mockResolvedValue(null);
    await expect(
      assertJuryCanOperateOnProject({ fairId: 'f1', projectId: 'p1', actor: baseActor })
    ).rejects.toThrow('No tienes asignación como jurado');
  });

  it('lanza 409 si la feria no está OPEN', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'jury-1', status: 'ACTIVE', role: 'JURY', organizationId: 'org1' });
    mockPrisma.fairJuryAssignment.findFirst.mockResolvedValue({ id: 'a1', fairId: 'f1', userId: 'jury-1' });
    mockPrisma.fair.findUnique.mockResolvedValue({ id: 'f1', status: 'DRAFT', organizationId: 'org1' });
    await expect(
      assertJuryCanOperateOnProject({ fairId: 'f1', projectId: 'p1', actor: baseActor })
    ).rejects.toThrow('feria está abierta');
  });

  it('lanza 403 si la organización no coincide', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'jury-1', status: 'ACTIVE', role: 'JURY', organizationId: 'org2' });
    mockPrisma.fairJuryAssignment.findFirst.mockResolvedValue({ id: 'a1', fairId: 'f1', userId: 'jury-1' });
    mockPrisma.fair.findUnique.mockResolvedValue({ id: 'f1', status: 'OPEN', organizationId: 'org1' });
    await expect(
      assertJuryCanOperateOnProject({ fairId: 'f1', projectId: 'p1', actor: baseActor })
    ).rejects.toThrow('No tienes acceso');
  });

  it('lanza 404 si el proyecto no existe', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'jury-1', status: 'ACTIVE', role: 'JURY', organizationId: 'org1' });
    mockPrisma.fairJuryAssignment.findFirst.mockResolvedValue({ id: 'a1', fairId: 'f1', userId: 'jury-1' });
    mockPrisma.fair.findUnique.mockResolvedValue({ id: 'f1', status: 'OPEN', organizationId: 'org1' });
    mockPrisma.project.findUnique.mockResolvedValue(null);
    await expect(
      assertJuryCanOperateOnProject({ fairId: 'f1', projectId: 'p1', actor: baseActor })
    ).rejects.toThrow('Proyecto no encontrado');
  });

  it('lanza 409 si el proyecto no tiene categoría', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'jury-1', status: 'ACTIVE', role: 'JURY', organizationId: 'org1' });
    mockPrisma.fairJuryAssignment.findFirst.mockResolvedValue({ id: 'a1', fairId: 'f1', userId: 'jury-1' });
    mockPrisma.fair.findUnique.mockResolvedValue({ id: 'f1', status: 'OPEN', organizationId: 'org1' });
    mockPrisma.project.findUnique.mockResolvedValue({ id: 'p1', fairId: 'f1', status: 'APPROVED', categoryId: null });
    await expect(
      assertJuryCanOperateOnProject({ fairId: 'f1', projectId: 'p1', actor: baseActor })
    ).rejects.toThrow('no tiene categoría');
  });

  it('lanza 403 si el JURY no tiene categorías', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'jury-1', status: 'ACTIVE', role: 'JURY', organizationId: 'org1' });
    mockPrisma.fairJuryAssignment.findFirst.mockResolvedValue({ id: 'a1', fairId: 'f1', userId: 'jury-1' });
    mockPrisma.fair.findUnique.mockResolvedValue({ id: 'f1', status: 'OPEN', organizationId: 'org1' });
    mockPrisma.project.findUnique.mockResolvedValue({ id: 'p1', fairId: 'f1', status: 'APPROVED', categoryId: 'cat1' });
    mockPrisma.fairJuryCategoryAssignment.findMany.mockResolvedValue([]);
    await expect(
      assertJuryCanOperateOnProject({ fairId: 'f1', projectId: 'p1', actor: baseActor })
    ).rejects.toThrow('No tienes categorías asignadas');
  });

  it('lanza 403 si el proyecto no está en las categorías del JURY', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'jury-1', status: 'ACTIVE', role: 'JURY', organizationId: 'org1' });
    mockPrisma.fairJuryAssignment.findFirst.mockResolvedValue({ id: 'a1', fairId: 'f1', userId: 'jury-1' });
    mockPrisma.fair.findUnique.mockResolvedValue({ id: 'f1', status: 'OPEN', organizationId: 'org1' });
    mockPrisma.project.findUnique.mockResolvedValue({ id: 'p1', fairId: 'f1', status: 'APPROVED', categoryId: 'cat-tech' });
    mockPrisma.fairJuryCategoryAssignment.findMany.mockResolvedValue([{ categoryId: 'cat-marketing' }]);
    await expect(
      assertJuryCanOperateOnProject({ fairId: 'f1', projectId: 'p1', actor: baseActor })
    ).rejects.toThrow('No tienes acceso a este proyecto');
  });

  it('retorna la asignación cuando todo es válido', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'jury-1', status: 'ACTIVE', role: 'JURY', organizationId: 'org1' });
    mockPrisma.fairJuryAssignment.findFirst.mockResolvedValue({ id: 'a1', fairId: 'f1', userId: 'jury-1' });
    mockPrisma.fair.findUnique.mockResolvedValue({ id: 'f1', status: 'OPEN', organizationId: 'org1' });
    mockPrisma.project.findUnique.mockResolvedValue({ id: 'p1', fairId: 'f1', status: 'APPROVED', categoryId: 'cat-marketing' });
    mockPrisma.fairJuryCategoryAssignment.findMany.mockResolvedValue([{ categoryId: 'cat-marketing' }]);

    const result = await assertJuryCanOperateOnProject({ fairId: 'f1', projectId: 'p1', actor: baseActor });
    expect(result).toEqual({ id: 'a1', fairId: 'f1', userId: 'jury-1' });
  });
});

describe('juryCategoryAccess — getJuryCategoryIds', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna array vacío si el JURY no está asignado', async () => {
    mockPrisma.fairJuryAssignment.findFirst.mockResolvedValue(null);
    const result = await getJuryCategoryIds('f1', 'jury-1');
    expect(result).toEqual([]);
  });

  it('retorna los IDs de las categorías asignadas', async () => {
    mockPrisma.fairJuryAssignment.findFirst.mockResolvedValue({ id: 'a1' });
    mockPrisma.fairJuryCategoryAssignment.findMany.mockResolvedValue([
      { categoryId: 'cat1' },
      { categoryId: 'cat2' },
    ]);
    const result = await getJuryCategoryIds('f1', 'jury-1');
    expect(result).toEqual(['cat1', 'cat2']);
  });
});

describe('juryCategoryAccess — assertJuryHasCategories', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lanza 403 si el JURY no tiene categorías', async () => {
    mockPrisma.fairJuryAssignment.findFirst.mockResolvedValue({ id: 'a1' });
    mockPrisma.fairJuryCategoryAssignment.count.mockResolvedValue(0);
    await expect(assertJuryHasCategories('f1', 'jury-1')).rejects.toThrow('No tienes categorías asignadas');
  });

  it('no lanza error si el JURY tiene categorías', async () => {
    mockPrisma.fairJuryAssignment.findFirst.mockResolvedValue({ id: 'a1' });
    mockPrisma.fairJuryCategoryAssignment.count.mockResolvedValue(2);
    await expect(assertJuryHasCategories('f1', 'jury-1')).resolves.toBeUndefined();
  });
});
