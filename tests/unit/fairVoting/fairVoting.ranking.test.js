// tests/unit/fairVoting/fairVoting.ranking.test.js
// Pruebas de la LÓGICA PURA de construcción de ranking de votos anónimos.
// Se ejecutan con `node --test` (sin BD).

// describe/it son los globales de Jest: importarlos de node:test ocultaba estas pruebas.
import assert from 'node:assert/strict';

import {
  buildVoteRanking,
  generateReceiptCode,
  mapVotingStatus,
  mapCastReceipt,
} from '../../../src/modules/fairVoting/fairVoting.helpers.js';

describe('generateReceiptCode', () => {
  it('devuelve 32 chars hex', () => {
    const c = generateReceiptCode();
    assert.match(c, /^[a-f0-9]{32}$/);
  });

  it('cada invocación genera un comprobante distinto', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateReceiptCode()));
    assert.equal(codes.size, 50);
  });
});

describe('mapVotingStatus', () => {
  it('no votado → has_voted=false', () => {
    assert.deepEqual(mapVotingStatus({ hasVoted: false, votedAt: null }), {
      has_voted: false,
      voted_at: null,
    });
  });

  it('votado → has_voted=true con timestamp', () => {
    const ts = new Date('2026-01-01T00:00:00Z');
    assert.deepEqual(mapVotingStatus({ hasVoted: true, votedAt: ts }), {
      has_voted: true,
      voted_at: ts,
    });
  });

  it('NO expone project_id (anonimato)', () => {
    const out = mapVotingStatus({ hasVoted: true, votedAt: new Date() });
    assert.equal(Object.prototype.hasOwnProperty.call(out, 'project_id'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(out, 'projectId'), false);
  });
});

describe('mapCastReceipt', () => {
  it('devuelve status=CAST y receipt_code (sin identidad)', () => {
    const out = mapCastReceipt('abcd1234');
    assert.equal(out.status, 'CAST');
    assert.equal(out.receipt_code, 'abcd1234');
    assert.equal(Object.prototype.hasOwnProperty.call(out, 'juryUserId'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(out, 'projectId'), false);
  });
});

describe('buildVoteRanking — orden', () => {
  it('ordena por votes DESC (A con 8 > B con 7)', () => {
    const r = buildVoteRanking(
      [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }],
      new Map([['A', 8], ['B', 7]])
    );
    assert.equal(r[0].project_id, 'A');
    assert.equal(r[1].project_id, 'B');
  });

  it('empate → project_id ASC (A antes que B)', () => {
    const r = buildVoteRanking(
      [{ id: 'B', name: 'B' }, { id: 'A', name: 'A' }],
      new Map([['A', 5], ['B', 5]])
    );
    assert.deepEqual(
      r.map((x) => x.project_id),
      ['A', 'B']
    );
  });

  it('es determinista', () => {
    const input = [
      [{ id: 'Z', name: 'Z' }, { id: 'M', name: 'M' }, { id: 'A', name: 'A' }],
      new Map([['Z', 3], ['M', 2], ['A', 3]]),
    ];
    const a = buildVoteRanking(input[0], input[1]).map((x) => x.project_id);
    const b = buildVoteRanking(input[0], input[1]).map((x) => x.project_id);
    assert.deepEqual(a, b);
  });
});

describe('buildVoteRanking — posición y votes=0', () => {
  it('asigna position 1..n solo a proyectos con votos > 0', () => {
    const r = buildVoteRanking(
      [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }, { id: 'C', name: 'C' }],
      new Map([['A', 1], ['C', 1]])
    );
    const evaluated = r.filter((x) => x.position !== null).map((x) => x.position);
    assert.deepEqual(evaluated, [1, 2]);
    assert.equal(r.find((x) => x.project_id === 'B').position, null);
  });

  it('proyectos con votes=0 quedan al final con position=null', () => {
    const r = buildVoteRanking(
      [{ id: 'NONE', name: 'N' }, { id: 'OK', name: 'OK' }],
      new Map([['OK', 2]])
    );
    assert.equal(r[0].project_id, 'OK');
    assert.equal(r[1].project_id, 'NONE');
    assert.equal(r[1].position, null);
    assert.equal(r[1].votes, 0);
  });

  it('no inventa ganador si votes=0 (no genera position)', () => {
    const r = buildVoteRanking(
      [{ id: 'A', name: 'A' }],
      new Map()
    );
    assert.equal(r[0].votes, 0);
    assert.equal(r[0].position, null);
  });
});
