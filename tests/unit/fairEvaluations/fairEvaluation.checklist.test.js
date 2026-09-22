// tests/unit/fairEvaluations/fairEvaluation.checklist.test.js
// Pruebas de la LÓGICA PURA de normalización de respuestas CHECKLIST.
// Se ejecutan con `node --test` (sin BD).

// describe/it son los globales de Jest: importarlos de node:test ocultaba estas pruebas.
import assert from 'node:assert/strict';

import {
  normalizeChecklistResponses,
  mapRubric,
  mapEvaluation,
} from '../../../src/modules/fairEvaluations/fairEvaluation.helpers.js';

const baseCriterion = (overrides = {}) => ({
  id: 'c1',
  rubricId: 'r1',
  name: 'Criterio 1',
  description: null,
  position: 1,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const baseRubric = (criteria) => ({
  id: 'r1',
  fairId: 'f1',
  name: 'Rúbrica',
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  criteria: criteria || [baseCriterion()],
});

describe('normalizeChecklistResponses', () => {
  it('acepta todas las respuestas activas', () => {
    const out = normalizeChecklistResponses({
      criteria: [baseCriterion({ id: 'a' }), baseCriterion({ id: 'b', position: 2 })],
      responses: [
        { criterion_id: 'a', checked: true },
        { criterion_id: 'b', checked: false },
      ],
    });
    assert.equal(out.length, 2);
    assert.equal(out[0].checked, true);
    assert.equal(out[1].checked, false);
  });

  it('rechaza si falta una respuesta de un criterio activo', () => {
    assert.throws(
      () =>
        normalizeChecklistResponses({
          criteria: [baseCriterion({ id: 'a' }), baseCriterion({ id: 'b', position: 2 })],
          responses: [{ criterion_id: 'a', checked: true }],
        }),
      /Faltan/
    );
  });

  it('rechaza criterio duplicado en el payload', () => {
    assert.throws(
      () =>
        normalizeChecklistResponses({
          criteria: [baseCriterion({ id: 'a' }), baseCriterion({ id: 'b', position: 2 })],
          responses: [
            { criterion_id: 'a', checked: true },
            { criterion_id: 'b', checked: false },
            { criterion_id: 'a', checked: false },
          ],
        }),
      /duplicado/
    );
  });

  it('rechaza criterio que no pertenece a la rúbrica', () => {
    assert.throws(
      () =>
        normalizeChecklistResponses({
          criteria: [baseCriterion({ id: 'a' })],
          responses: [{ criterion_id: 'otro', checked: true }],
        }),
      /no pertenece a la rúbrica/
    );
  });

  it('rechaza respuesta a criterio inactivo', () => {
    assert.throws(
      () =>
        normalizeChecklistResponses({
          criteria: [baseCriterion({ id: 'a', isActive: false })],
          responses: [{ criterion_id: 'a', checked: true }],
        }),
      /inactivo/
    );
  });

  it('no exige respuestas para criterios inactivos', () => {
    const out = normalizeChecklistResponses({
      criteria: [baseCriterion({ id: 'a', isActive: true }), baseCriterion({ id: 'b', position: 2, isActive: false })],
      responses: [{ criterion_id: 'a', checked: true }], // solo el activo
    });
    assert.equal(out.length, 1);
  });

  it('coerce checked truthy/falsy', () => {
    const out = normalizeChecklistResponses({
      criteria: [baseCriterion({ id: 'a' })],
      responses: [{ criterion_id: 'a', checked: 1 }],
    });
    assert.equal(out[0].checked, true);
  });
});

describe('mapRubric', () => {
  it('mapea estructura snake_case', () => {
    const r = mapRubric(baseRubric([baseCriterion()]));
    assert.equal(r.fair_id, 'f1');
    assert.equal(r.criteria.length, 1);
    assert.equal(r.criteria[0].is_active, true);
    assert.equal(r.criteria[0].position, 1);
  });
});

describe('mapEvaluation', () => {
  it('expone submitted (boolean) y submitted_at', () => {
    const ts = new Date('2026-01-01T00:00:00Z');
    const mapped = mapEvaluation({
      id: 'e1',
      fairId: 'f1',
      projectId: 'p1',
      juryUserId: 'j1',
      rubricId: 'r1',
      submittedAt: ts,
      createdAt: new Date(),
      updatedAt: new Date(),
      project: { id: 'p1', name: 'P1', status: 'APPROVED' },
      jury: { id: 'j1', firstName: 'J', lastName: 'K', institutionalId: 'X' },
      details: [
        { id: 'd1', criterionId: 'c1', checked: true, criterion: { id: 'c1', name: 'C1', position: 1, isActive: true } },
      ],
    });
    assert.equal(mapped.submitted, true);
    assert.equal(mapped.submitted_at, ts);
    assert.equal(mapped.responses.length, 1);
    assert.equal(mapped.responses[0].checked, true);
    assert.equal(mapped.responses[0].criterion_name, 'C1');
  });

  it('submitted=false cuando submittedAt es null', () => {
    const mapped = mapEvaluation({
      id: 'e1',
      fairId: 'f1',
      projectId: 'p1',
      juryUserId: 'j1',
      rubricId: 'r1',
      submittedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      project: null,
      jury: null,
      details: [],
    });
    assert.equal(mapped.submitted, false);
    assert.equal(mapped.submitted_at, null);
  });
});
