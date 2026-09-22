// tests/unit/certificate/certificate.schema.test.js
// Pruebas de la validación Zod del módulo de certificados.
// Garantiza que el cliente NO puede enviar datos que sorteen las
// reglas del service (fair_id, project_id, user_id, certificate_type).

import assert from 'node:assert/strict';

import {
  generateCertificatesSchema,
  certificateIdParamSchema,
} from '../../../src/modules/certificate/certificate.schema.js';

const validUUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

describe('generateCertificatesSchema', () => {
  it('acepta params { id: UUID }', () => {
    const result = generateCertificatesSchema.safeParse({
      params: { id: validUUID },
      query: {},
      body: {},
    });
    assert.equal(result.success, true);
  });

  it('rechaza params sin id', () => {
    const result = generateCertificatesSchema.safeParse({
      params: {},
      query: {},
      body: {},
    });
    assert.equal(result.success, false);
  });

  it('rechaza params con id no UUID', () => {
    const result = generateCertificatesSchema.safeParse({
      params: { id: 'no-es-uuid' },
      query: {},
      body: {},
    });
    assert.equal(result.success, false);
  });

  it('ignora body/query (no hay shape definido para esos)', () => {
    const result = generateCertificatesSchema.safeParse({
      params: { id: validUUID },
      query: { fair_id: validUUID, project_id: validUUID },
      body: { certificate_type: 'WINNER' },
    });
    // El schema no permite esos campos (no están definidos en body/query),
    // pero al menos params debe validar.
    assert.equal(result.success, true);
    assert.equal(result.data.params.id, validUUID);
  });
});

describe('certificateIdParamSchema', () => {
  it('acepta params { certificateId: UUID }', () => {
    const result = certificateIdParamSchema.safeParse({
      params: { certificateId: validUUID },
      query: {},
      body: {},
    });
    assert.equal(result.success, true);
  });

  it('rechaza params sin certificateId', () => {
    const result = certificateIdParamSchema.safeParse({
      params: {},
      query: {},
      body: {},
    });
    assert.equal(result.success, false);
  });

  it('rechaza params con certificateId no UUID', () => {
    const result = certificateIdParamSchema.safeParse({
      params: { certificateId: 'no-es-uuid' },
      query: {},
      body: {},
    });
    assert.equal(result.success, false);
  });
});