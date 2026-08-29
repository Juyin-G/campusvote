import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule(
  '../../../src/modules/organizations/organization/organization.repository.js',
  () => ({
    default: {
      findOrgById: jest.fn(),
      findOrgByCode: jest.fn(),
      listOrgs: jest.fn(),
      countOrgs: jest.fn(),
      createOrg: jest.fn(),
      updateOrg: jest.fn(),
      completeOrgOnboarding: jest.fn(),
      deleteOrgById: jest.fn(),
    },
  })
);

const orgService = await import(
  '../../../src/modules/organizations/organization/organization.service.js'
);

const { default: orgRepository } = await import(
  '../../../src/modules/organizations/organization/organization.repository.js'
);

const { ApiError } = await import(
  '../../../src/shared/errors/index.js'
);

describe('Organization Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrganization', () => {
    it('debe crear la organización si el código no está en uso', async () => {
      const data = {
        name: 'Universidad',
        code: 'UNI',
      };

      orgRepository.findOrgByCode.mockResolvedValue(null);

      orgRepository.createOrg.mockResolvedValue({
        id: 'org-1',
        code: 'UNI',
        ...data,
      });

      const result = await orgService.createOrganization(data);

      expect(orgRepository.findOrgByCode).toHaveBeenCalledWith('UNI');
      expect(result.id).toBe('org-1');
    });

    it('debe lanzar ApiError si el código ya existe', async () => {
      orgRepository.findOrgByCode.mockResolvedValue({
        id: 'org-existente',
        code: 'UNI',
      });

      await expect(
        orgService.createOrganization({
          name: 'Uni',
          code: 'UNI',
        })
      )
        .rejects
        .toThrow(ApiError);
    });
  });

  describe('getOrganizationById', () => {
    it('debe lanzar ApiError si la organización no existe', async () => {
      orgRepository.findOrgById.mockResolvedValue(null);

      await expect(
        orgService.getOrganizationById('uuid-inexistente')
      )
        .rejects
        .toThrow(ApiError);
    });
  });

  describe('completeOnboarding', () => {
    it('debe lanzar ApiError si el onboarding ya fue completado', async () => {
      orgRepository.findOrgById.mockResolvedValue({
        id: 'org-1',
        onboardingCompleted: true,
      });

      await expect(
        orgService.completeOnboarding('org-1')
      )
        .rejects
        .toThrow(ApiError);
    });
  });
});