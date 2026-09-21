// tests/unit/fairEngagement/fairEngagement.helpers.test.js
// Pruebas de helpers puros: validación de comentarios, mapeos, hitos.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  COMMENT_MIN_LENGTH,
  COMMENT_MAX_LENGTH,
  cleanComment,
  nextMilestone,
  mapCommentForJury,
  mapCommentForStudent,
} from '../../../src/modules/fairEngagement/fairEngagement.helpers.js';

describe('cleanComment', () => {
  it('recorta espacios', () => {
    assert.equal(cleanComment('  hola  '), 'hola');
  });
  it('devuelve vacío si no es string', () => {
    assert.equal(cleanComment(null), '');
    assert.equal(cleanComment(undefined), '');
  });
});

describe('COMMENT_MIN_LENGTH / COMMENT_MAX_LENGTH', () => {
  it('los límites son coherentes (10–1000)', () => {
    assert.equal(COMMENT_MIN_LENGTH, 10);
    assert.equal(COMMENT_MAX_LENGTH, 1000);
  });
});

describe('nextMilestone', () => {
  it('devuelve null si count < 10', () => {
    assert.equal(nextMilestone(0), null);
    assert.equal(nextMilestone(9), null);
  });
  it('devuelve 10 cuando count está entre 10 y 19', () => {
    assert.equal(nextMilestone(10), 10);
    assert.equal(nextMilestone(15), 10);
    assert.equal(nextMilestone(19), 10);
  });
  it('devuelve 20 cuando count está entre 20 y 29', () => {
    assert.equal(nextMilestone(20), 20);
    assert.equal(nextMilestone(25), 20);
    assert.equal(nextMilestone(29), 20);
  });
  it('devuelve múltiplos mayores (30, 40, …)', () => {
    assert.equal(nextMilestone(30), 30);
    assert.equal(nextMilestone(50), 50);
    assert.equal(nextMilestone(99), 90);
    assert.equal(nextMilestone(100), 100);
    assert.equal(nextMilestone(101), 100);
  });
  it('rango de múltiplos de 10 según count', () => {
    // Verifica que los hitos son múltiplos de 10 consecutivos.
    for (let n = 10; n <= 100; n += 10) {
      assert.equal(nextMilestone(n), n);
      assert.equal(nextMilestone(n + 5), n);
    }
  });
});

describe('mapCommentForJury', () => {
  it('incluye el autor con nombre completo', () => {
    const out = mapCommentForJury({
      id: 'c1',
      fairId: 'f1',
      projectId: 'p1',
      jury: {
        id: 'j1',
        firstName: 'Ana',
        lastName: 'Pérez',
        institutionalId: 'X-123',
      },
      comment: 'Buen trabajo',
      isAnonymous: true,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    });
    assert.equal(out.jury.first_name, 'Ana');
    assert.equal(out.jury.last_name, 'Pérez');
    assert.equal(out.is_anonymous, true);
  });

  it('tolerante a jury null (registro huérfano)', () => {
    const out = mapCommentForJury({
      id: 'c1',
      fairId: 'f1',
      projectId: 'p1',
      jury: null,
      comment: 'X',
      isAnonymous: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    assert.equal(out.jury, null);
  });
});

describe('mapCommentForStudent', () => {
  it('NO expone el autor aunque el objeto tenga jury', () => {
    const out = mapCommentForStudent({
      id: 'c1',
      comment: 'X',
      isAnonymous: true,
      createdAt: new Date(),
      jury: { id: 'j1', firstName: 'Ana' },
    });
    assert.equal(Object.prototype.hasOwnProperty.call(out, 'jury'), false);
    assert.equal(out.comment, 'X');
    assert.equal(out.is_anonymous, true);
  });

  it('shape mínimo: id, comment, is_anonymous, created_at', () => {
    const out = mapCommentForStudent({
      id: 'c1',
      comment: 'X',
      isAnonymous: false,
      createdAt: new Date(),
    });
    assert.deepEqual(Object.keys(out).sort(), ['comment', 'created_at', 'id', 'is_anonymous']);
  });
});
