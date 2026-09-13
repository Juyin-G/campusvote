// tests/unit/fairResults/fairResult.ranking.test.js
// Pruebas de la LÓGICA PURA de cálculo de resultados de ferias.
// Se ejecutan con `node --test` (sin PostgreSQL): solo importan la lógica
// derivada (computeProjectStats / buildFairRanking) desde el service.
//
// Las reglas que dependen de la BD (404, tenant, filtro "solo APPROVED",
// persistencia) se cubren en tests/integration/fairResults.integration.test.js
// y requieren PostgreSQL real (jest + setup-db).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeProjectStats,
  buildFairRanking,
} from '../../../src/modules/fairResults/fairResult.service.js';

const projects = (entries) => entries.map(([id, name]) => ({ id, name }));

const project = (id, name = `P-${id}`) => ({ id, name });

// evaluate: Map projectId -> totals
const totalsByProject = (entries) => new Map(entries.map(([id, totals]) => [id, totals]));

describe('computeProjectStats', () => {
  it('sin evaluaciones → average_score null y evaluation_count 0 (no inventa 0)', () => {
    assert.deepEqual(computeProjectStats([]), {
      evaluationCount: 0,
      averageScore: null,
      averageHundredths: null,
    });
  });

  it('promedio exacto (18 + 19 + 17 → 18)', () => {
    const stats = computeProjectStats([18, 19, 17]);
    assert.equal(stats.evaluationCount, 3);
    assert.equal(stats.averageScore, 18);
  });

  it('redondea a 2 decimales (18.75 y 17.90)', () => {
    assert.equal(computeProjectStats([18.75, 18.75]).averageScore, 18.75);
    assert.equal(computeProjectStats([17.9, 17.9]).averageScore, 17.9);
  });

  it('round-half-up en el promedio (937.5 centésimas → 9.38)', () => {
    const stats = computeProjectStats([9.4, 9.35]);
    assert.equal(stats.averageScore, 9.38);
  });

  it('serializa como Number legible (JSON no muestra Decimal)', () => {
    assert.equal(JSON.stringify(computeProjectStats([18.75]).averageScore), '18.75');
    assert.equal(JSON.stringify(computeProjectStats([18.0]).averageScore), '18');
  });
});

describe('buildFairRanking — orden', () => {
  it('ordena por average_score DESC (A 18.50 > C 17.80)', () => {
    const ranking = buildFairRanking({
      status: 'CLOSED',
      projects: projects([['A', 'A'], ['C', 'C']]),
      evaluationsByProject: totalsByProject([
        ['A', [18.5, 18.5, 18.5]],
        ['C', [17.8, 17.8, 17.8, 17.8]],
      ]),
    });
    assert.equal(ranking[0].project_id, 'A');
    assert.equal(ranking[1].project_id, 'C');
  });

  it('empate de promedio → evaluation_count DESC (A con 3 > B con 2)', () => {
    const ranking = buildFairRanking({
      status: 'CLOSED',
      projects: projects([['A', 'A'], ['B', 'B']]),
      evaluationsByProject: totalsByProject([
        ['A', [18.5, 18.5, 18.5]],
        ['B', [18.5, 18.5]],
      ]),
    });
    assert.equal(ranking[0].project_id, 'A');
    assert.equal(ranking[1].project_id, 'B');
  });

  it('empate completo → project.id ASC (determinista)', () => {
    const ranking = buildFairRanking({
      status: 'CLOSED',
      projects: projects([['B', 'B'], ['A', 'A'], ['C', 'C']]),
      evaluationsByProject: totalsByProject([
        ['B', [10, 10]],
        ['A', [10, 10]],
        ['C', [10, 10]],
      ]),
    });
    assert.deepEqual(
      ranking.map((r) => r.project_id),
      ['A', 'B', 'C']
    );
  });

  it('es determinista ante la misma entrada (mismo orden siempre)', () => {
    const input = {
      status: 'CLOSED',
      projects: projects([['Z', 'Z'], ['M', 'M'], ['A', 'A']]),
      evaluationsByProject: totalsByProject([
        ['Z', [15, 15]],
        ['M', [12, 12]],
        ['A', [15, 15]],
      ]),
    };
    const a = buildFairRanking(input).map((r) => r.project_id);
    const b = buildFairRanking(input).map((r) => r.project_id);
    assert.deepEqual(a, b);
  });
});

describe('buildFairRanking — ganador', () => {
  it('CLOSED publicado → winner=true solo en position 1', () => {
    const ranking = buildFairRanking({
      status: 'CLOSED',
      published: true,
      projects: projects([['A', 'A'], ['B', 'B']]),
      evaluationsByProject: totalsByProject([
        ['A', [18]],
        ['B', [16]],
      ]),
    });
    assert.equal(ranking[0].winner, true);
    assert.equal(ranking[1].winner, false);
  });

  it('CLOSED SIN publicar → winner=false incluso en position 1 (no hay ganador oficial)', () => {
    const ranking = buildFairRanking({
      status: 'CLOSED',
      published: false,
      projects: projects([['A', 'A'], ['B', 'B']]),
      evaluationsByProject: totalsByProject([
        ['A', [18]],
        ['B', [16]],
      ]),
    });
    assert.equal(ranking[0].position, 1);
    assert.equal(ranking[0].winner, false);
    assert.equal(ranking[1].winner, false);
  });

  it('CLOSED publicado → winner aplica SOLO a position 1 (resto false)', () => {
    const ranking = buildFairRanking({
      status: 'CLOSED',
      published: true,
      projects: projects([['A', 'A'], ['B', 'B'], ['C', 'C']]),
      evaluationsByProject: totalsByProject([
        ['A', [18]],
        ['B', [16]],
        ['C', [15]],
      ]),
    });
    assert.equal(ranking[0].winner, true);
    assert.equal(ranking.slice(1).every((r) => r.winner === false), true);
  });

  it('OPEN → nunca winner=true (no existe ganador definitivo)', () => {
    const ranking = buildFairRanking({
      status: 'OPEN',
      projects: projects([['A', 'A'], ['B', 'B']]),
      evaluationsByProject: totalsByProject([
        ['A', [18]],
        ['B', [16]],
      ]),
    });
    assert.ok(ranking.every((r) => r.winner === false));
    assert.equal(ranking[0].position, 1);
    assert.equal(ranking[0].winner, false);
  });

  it('DRAFT → nunca winner=true', () => {
    const ranking = buildFairRanking({
      status: 'DRAFT',
      projects: projects([['A', 'A']]),
      evaluationsByProject: totalsByProject([['A', [18]]]),
    });
    assert.equal(ranking[0].winner, false);
  });

  it('proyecto SIN evaluaciones nunca gana en CLOSED publicado', () => {
    const ranking = buildFairRanking({
      status: 'CLOSED',
      published: true,
      projects: projects([['A', 'A'], ['B', 'B']]),
      evaluationsByProject: totalsByProject([['A', [18]]]),
    });
    const b = ranking.find((r) => r.project_id === 'B');
    assert.equal(b.position, null);
    assert.equal(b.winner, false);
    assert.equal(b.average_score, null);
    assert.equal(b.evaluation_count, 0);
  });
});

describe('buildFairRanking — estructura', () => {
  it('asigna positions 1..n solo a proyectos EVALUADOS', () => {
    const ranking = buildFairRanking({
      status: 'CLOSED',
      projects: projects([['A', 'A'], ['B', 'B'], ['C', 'C']]),
      evaluationsByProject: totalsByProject([
        ['A', [18]],
        ['C', [16]],
      ]),
    });
    assert.deepEqual(
      ranking.filter((r) => r.position !== null).map((r) => r.position),
      [1, 2]
    );
    assert.equal(ranking.find((r) => r.project_id === 'B').position, null);
  });

  it('proyectos sin evaluaciones van al final del listado', () => {
    const ranking = buildFairRanking({
      status: 'CLOSED',
      projects: projects([['NONE1', 'N1'], ['RANKED', 'Rd'], ['NONE2', 'N2']]),
      evaluationsByProject: totalsByProject([['RANKED', [20]]]),
    });
    assert.equal(ranking[0].project_id, 'RANKED');
    assert.ok(ranking.slice(1).every((r) => r.position === null));
  });

  it('expone winner boolean siempre', () => {
    const ranking = buildFairRanking({
      status: 'OPEN',
      projects: projects([['A', 'A']]),
      evaluationsByProject: totalsByProject([['A', [10]]]),
    });
    assert.equal(typeof ranking[0].winner, 'boolean');
  });
});