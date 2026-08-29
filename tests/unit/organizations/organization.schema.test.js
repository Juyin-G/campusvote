import { describe, it, expect } from '@jest/globals';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
} from '../../../src/modules/organizations/organization/organization.schema.js';
import {
  createOrganizationRequestSchema,
  rejectRequestSchema,
} from '../../../src/modules/organizations/organization-request/organization.schema.js';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('Organization Schema Unit Tests', () => {
  describe('createOrganizationSchema', () => {
    it('debe validar exitosamente un payload correcto', () => {
      const input = {
        body: {
          name: 'Universidad Nacional',
          code: 'UNAL',
          org_type: 'UNIVERSITY',
          primary_color: '#0066CC',
        },
      };

      const result = createOrganizationSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.code).toBe('UNAL');
        expect(result.data.body.secondary_color).toBe('#FFD700');
      }
    });

    it('debe fallar si falta el nombre o el código', () => {
      const input = { body: { org_type: 'UNIVERSITY' } };
      const result = createOrganizationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('debe fallar si el color primario no es un HEX válido', () => {
      const input = {
        body: {
          name: 'Universidad',
          code: 'UNIV',
          primary_color: 'red-invalid',
        },
      };
      const result = createOrganizationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateOrganizationSchema', () => {
    it('debe rechazar un objeto vacío', () => {
      const result = updateOrganizationSchema.safeParse({ body: {} });
      expect(result.success).toBe(false);
    });

    it('debe permitir actualizaciones parciales válidas', () => {
      const result = updateOrganizationSchema.safeParse({
        body: { name: 'Nuevo Nombre' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('createOrganizationRequestSchema', () => {
    it('debe transformar y coercionar estimated_members si llega como string', () => {
      const input = {
        body: {
          institution_name: 'Instituto Central',
          institution_type: 'INSTITUTE',
          country: 'Perú',
          estimated_members: '250',
          contact_email: 'CORREO@TEST.COM',
        },
      };

      const result = createOrganizationRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.estimated_members).toBe(250);
        expect(result.data.body.contact_email).toBe('correo@test.com');
      }
    });
  });

  describe('rejectRequestSchema', () => {
    it('debe requerir un motivo de rechazo no vacío', () => {
      const invalid = rejectRequestSchema.safeParse({
        params: { id: VALID_UUID },
        body: { rejection_reason: '  ' },
      });
      expect(invalid.success).toBe(false);

      const valid = rejectRequestSchema.safeParse({
        params: { id: VALID_UUID },
        body: { rejection_reason: 'Documentación incompleta' },
      });
      expect(valid.success).toBe(true);
    });
  });
});
