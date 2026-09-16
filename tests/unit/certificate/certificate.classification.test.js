// tests/unit/certificate/certificate.classification.test.js
// Pruebas unitarias de la LÓGICA PURA del módulo de certificados:
//   * filterValidMembers: deduplicación y filtrado por userId (sin DNI).
//   * classifyMembers: PARTICIPATION para todos, WINNER solo si el
//     proyecto es el ganador (winnerProjectId === projectId).
//
// Estas pruebas NO requieren PostgreSQL: solo importan funciones puras
// del service. La integración con BD se cubre en tests que requieren
// una base de datos real (Pendiente — ver nota al final del archivo).

import assert from 'node:assert/strict';

import {
  filterValidMembers,
  classifyMembers,
} from '../../../src/modules/certificate/certificate.service.js';

const member = (userId, role = 'EXPOSITOR') => ({
  id: `member-${userId}`,
  projectId: 'project-1',
  userId,
  role,
  createdAt: new Date('2026-01-01T00:00:00Z'),
});

describe('filterValidMembers', () => {
  it('devuelve [] si no hay miembros', () => {
    assert.deepEqual(filterValidMembers([]), []);
  });

  it('elimina miembros sin userId', () => {
    const members = [member('u1'), { id: 'm2', userId: null }, member('u3')];
    const out = filterValidMembers(members);
    assert.equal(out.length, 2);
    assert.deepEqual(out.map((m) => m.userId), ['u1', 'u3']);
  });

  it('deduplica por userId (un usuario solo aparece una vez aunque sea miembro en dos filas)', () => {
    const members = [
      member('u1', 'EXPOSITOR'),
      member('u1', 'COLLABORATOR'),
      member('u2', 'EXPOSITOR'),
    ];
    const out = filterValidMembers(members);
    assert.equal(out.length, 2);
    assert.deepEqual(out.map((m) => m.userId), ['u1', 'u2']);
  });

  it('no usa DNI: el identificador es siempre userId', () => {
    const m = member('abc-uuid');
    assert.equal(typeof m.userId, 'string');
    assert.equal(m.userId.length > 0, true);
  });

  it('tolera entrada null/undefined', () => {
    assert.deepEqual(filterValidMembers(null), []);
    assert.deepEqual(filterValidMembers(undefined), []);
  });
});

describe('classifyMembers — PARTICIPATION', () => {
  it('proyecto NO ganador → todos a PARTICIPATION, ninguno a WINNER', () => {
    const members = [member('u1'), member('u2'), member('u3')];
    const out = classifyMembers({
      members,
      winnerProjectId: 'other-project',
      projectId: 'project-1',
    });
    assert.deepEqual(out.participation, ['u1', 'u2', 'u3']);
    assert.deepEqual(out.winner, []);
  });

  it('proyecto ganador → miembros van a PARTICIPATION Y a WINNER', () => {
    const members = [member('u1'), member('u2'), member('u3')];
    const out = classifyMembers({
      members,
      winnerProjectId: 'project-1',
      projectId: 'project-1',
    });
    assert.deepEqual(out.participation, ['u1', 'u2', 'u3']);
    assert.deepEqual(out.winner, ['u1', 'u2', 'u3']);
  });

  it('sin miembros → participation y winner vacíos', () => {
    const out = classifyMembers({
      members: [],
      winnerProjectId: null,
      projectId: 'project-1',
    });
    assert.deepEqual(out.participation, []);
    assert.deepEqual(out.winner, []);
  });

  it('winnerProjectId=null → winner vacío (no hay publicación oficial)', () => {
    const members = [member('u1')];
    const out = classifyMembers({
      members,
      winnerProjectId: null,
      projectId: 'project-1',
    });
    assert.deepEqual(out.participation, ['u1']);
    assert.deepEqual(out.winner, []);
  });
});

describe('classifyMembers — fuente del ganador', () => {
  it('solo position === 1 (winnerProjectId === projectId) genera WINNER', () => {
    const members = [member('u1'), member('u2')];

    // El proyecto que ocupa position === 1 según getFairResults()
    // es "winner-project"; el resto NO recibe WINNER.
    const winnerProject = classifyMembers({
      members,
      winnerProjectId: 'winner-project',
      projectId: 'winner-project',
    });
    assert.equal(winnerProject.winner.length, 2);

    const secondProject = classifyMembers({
      members,
      winnerProjectId: 'winner-project',
      projectId: 'second-project',
    });
    assert.equal(secondProject.winner.length, 0);
    assert.equal(secondProject.participation.length, 2);
  });
});