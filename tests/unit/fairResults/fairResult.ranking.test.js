// tests/unit/fairResults/fairResult.ranking.test.js
// Pruebas de la LÓGICA PURA de cálculo de resultados de ferias (modelo VOTOS).
// Se ejecutan con `node --test` (sin PostgreSQL).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildVoteRanking } from '../../../src/modules/fairResults/fairResult.service.js';

const projects = (entries) => entries.map(([id, name]) => ({ id, name }));

const totalsByProject = (entries) => new Map(entries.map(([id, total]) => [id, total]));

describe('buildVoteRanking — orden por votos', () => {
  it('ordena por votes DESC (A con 8 > B con 7)', () => {
    const r = buildVoteRanking({
      status: 'OPEN',
      projects: projects([['A', 'A'], ['B', 'B']]),
      votesByProject: totalsByProject([['A', 8], ['B', 7]]),
    });
    assert.equal(r[0].project_id, 'A');
    assert.equal(r[1].project_id, 'B');
  });

  it('empate de votos → project_id ASC', () => {
    const r = buildVoteRanking({
      status: 'OPEN',
      projects: projects([['B', 'B'], ['A', 'A']]),
      votesByProject: totalsByProject([['A', 5], ['B', 5]]),
    });
    assert.deepEqual(
      r.map((x) => x.project_id),
      ['A', 'B']
    );
  });

  it('es determinista', () => {
    const input = {
      status: 'OPEN',
      projects: projects([['Z', 'Z'], ['M', 'M'], ['A', 'A']]),
      votesByProject: totalsByProject([['Z', 3], ['M', 2], ['A', 3]]),
    };
    const a = buildVoteRanking(input).map((x) => x.project_id);
    const b = buildVoteRanking(input).map((x) => x.project_id);
    assert.deepEqual(a, b);
  });
});

describe('buildVoteRanking — ganador', () => {
  it('CLOSED + published → winner=true solo en position 1', () => {
    const r = buildVoteRanking({
      status: 'CLOSED',
      published: true,
      projects: projects([['A', 'A'], ['B', 'B']]),
      votesByProject: totalsByProject([['A', 18], ['B', 16]]),
    });
    assert.equal(r[0].winner, true);
    assert.equal(r[1].winner, false);
  });

  it('CLOSED SIN publicar → winner=false en position 1 (no hay ganador oficial)', () => {
    const r = buildVoteRanking({
      status: 'CLOSED',
      published: false,
      projects: projects([['A', 'A'], ['B', 'B']]),
      votesByProject: totalsByProject([['A', 18], ['B', 16]]),
    });
    assert.equal(r[0].position, 1);
    assert.equal(r[0].winner, false);
  });

  it('OPEN → nunca winner=true', () => {
    const r = buildVoteRanking({
      status: 'OPEN',
      projects: projects([['A', 'A'], ['B', 'B']]),
      votesByProject: totalsByProject([['A', 18], ['B', 16]]),
    });
    assert.ok(r.every((x) => x.winner === false));
  });

  it('DRAFT → nunca winner=true', () => {
    const r = buildVoteRanking({
      status: 'DRAFT',
      projects: projects([['A', 'A']]),
      votesByProject: totalsByProject([['A', 18]]),
    });
    assert.equal(r[0].winner, false);
  });
});

describe('buildVoteRanking — votes=0', () => {
  it('proyectos sin votos quedan al final con position=null', () => {
    const r = buildVoteRanking({
      status: 'CLOSED',
      published: true,
      projects: projects([['NONE', 'N'], ['OK', 'OK']]),
      votesByProject: totalsByProject([['OK', 2]]),
    });
    assert.equal(r[0].project_id, 'OK');
    assert.equal(r[1].project_id, 'NONE');
    assert.equal(r[1].position, null);
    assert.equal(r[1].votes, 0);
  });

  it('votes=0 nunca gana en CLOSED publicado', () => {
    const r = buildVoteRanking({
      status: 'CLOSED',
      published: true,
      projects: projects([['A', 'A'], ['B', 'B']]),
      votesByProject: totalsByProject([['A', 18]]),
    });
    const b = r.find((x) => x.project_id === 'B');
    assert.equal(b.position, null);
    assert.equal(b.winner, false);
    assert.equal(b.votes, 0);
  });
});

describe('buildVoteRanking — estructura', () => {
  it('asigna positions 1..n solo a proyectos con votes > 0', () => {
    const r = buildVoteRanking({
      status: 'CLOSED',
      projects: projects([['A', 'A'], ['B', 'B'], ['C', 'C']]),
      votesByProject: totalsByProject([['A', 1], ['C', 1]]),
    });
    const evaluated = r.filter((x) => x.position !== null).map((x) => x.position);
    assert.deepEqual(evaluated, [1, 2]);
    assert.equal(r.find((x) => x.project_id === 'B').position, null);
  });

  it('expone winner boolean siempre', () => {
    const r = buildVoteRanking({
      status: 'OPEN',
      projects: projects([['A', 'A']]),
      votesByProject: totalsByProject([['A', 10]]),
    });
    assert.equal(typeof r[0].winner, 'boolean');
  });
});
