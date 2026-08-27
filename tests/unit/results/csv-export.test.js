// tests/unit/results/csv-export.test.js
// S7-12 — Tests del exportador CSV (csvEscape + flattenResults + generateResultsCsv).

// Sin mocks: probamos funciones puras.

const { csvEscape, flattenResults, generateResultsCsv } = await import(
  '../../../src/modules/results/export/export.service.js'
);

describe('CSV — csvEscape', () => {
  it('devuelve vacío para null/undefined', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  it('mantiene strings simples sin escape', () => {
    expect(csvEscape('Hola')).toBe('Hola');
    expect(csvEscape('café')).toBe('café');
  });

  it('escapa comillas dobles', () => {
    expect(csvEscape('Él dijo "hola"')).toBe('"Él dijo ""hola"""');
  });

  it('envuelve en comillas si contiene coma', () => {
    expect(csvEscape('a, b')).toBe('"a, b"');
  });

  it('envuelve en comillas si contiene salto de línea', () => {
    expect(csvEscape('l1\nl2')).toBe('"l1\nl2"');
  });

  it('protege contra Formula Injection (=)', () => {
    expect(csvEscape('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
  });

  it('protege contra Formula Injection (+)', () => {
    expect(csvEscape('+CMD')).toBe("'+CMD");
  });

  it('protege contra Formula Injection (-)', () => {
    expect(csvEscape('-2+3')).toBe("'-2+3");
  });

  it('protege contra Formula Injection (@)', () => {
    expect(csvEscape('@SUM')).toBe("'@SUM");
  });

  it('protege contra tab inicial', () => {
    expect(csvEscape('\tmal')).toBe("'\tmal");
  });

  it('protege contra CR inicial', () => {
    // CR inicial dispara DOS mecanismos: prefijo de Formula Injection
    // Y escape RFC 4180 (porque \r está en [",\n\r]).
    expect(csvEscape('\rmal')).toBe('"\'\rmal"');
  });
});

describe('CSV — generateResultsCsv', () => {
  const fakeData = {
    election_id: 'e1',
    detail: {
      positions: [
        {
          position_id: 'p1',
          position_name: 'Rector',
          seats: 1,
          options: [
            {
              option_id: 'o1',
              label: 'Lista A',
              option_type: 'CANDIDATE_LIST',
              candidate_list_id: 'cl1',
              votes_count: 100,
              percentage: 80,
            },
            {
              option_id: 'o2',
              label: 'Voto en blanco',
              option_type: 'BLANK',
              candidate_list_id: null,
              votes_count: 25,
              percentage: 20,
            },
          ],
        },
      ],
    },
  };

  it('genera un Buffer con BOM UTF-8', () => {
    const buf = generateResultsCsv(fakeData);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbb);
    expect(buf[2]).toBe(0xbf);
  });

  it('incluye encabezados + filas en CSV', () => {
    const buf = generateResultsCsv(fakeData);
    const text = buf.toString('utf8').replace(/^\uFEFF/, '');
    expect(text).toContain('election_id,position_id,position_name');
    expect(text).toContain('e1,p1,Rector,o1,Lista A,CANDIDATE_LIST,cl1,100,80.00');
    expect(text).toContain('e1,p1,Rector,o2,Voto en blanco,BLANK,,25,20.00');
  });

  it('maneja candidato_list_id null como vacío', () => {
    const buf = generateResultsCsv(fakeData);
    const text = buf.toString('utf8').replace(/^\uFEFF/, '');
    // La línea BLANK tiene candidate_list_id = null → string vacío.
    expect(text).toMatch(/BLANK,,25/);
  });
});

describe('CSV — flattenResults', () => {
  it('devuelve array vacío si no hay posiciones', () => {
    expect(flattenResults({ detail: {} })).toEqual([]);
    expect(flattenResults({ detail: { positions: [] } })).toEqual([]);
  });

  it('genera una fila por opción', () => {
    const data = {
      election_id: 'e1',
      detail: {
        positions: [
          {
            position_id: 'p1',
            position_name: 'Cargo',
            seats: 1,
            options: [
              { option_id: 'o1', label: 'A', option_type: 'CANDIDATE_LIST', candidate_list_id: 'cl1', votes_count: 5, percentage: 100 },
            ],
          },
        ],
      },
    };
    const rows = flattenResults(data);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(9);
  });
});
