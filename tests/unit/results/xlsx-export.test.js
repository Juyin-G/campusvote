// tests/unit/results/xlsx-export.test.js
// S7-12 — Tests del exportador XLSX (exceljs).

const { generateResultsXlsx, flattenResults } = await import(
  '../../../src/modules/results/export/export.service.js'
);

describe('XLSX — generateResultsXlsx', () => {
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

  it('genera un Buffer XLSX', async () => {
    const buf = await generateResultsXlsx(fakeData);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
    // ZIP magic number para .xlsx
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it('maneja datos vacíos sin lanzar', async () => {
    const buf = await generateResultsXlsx({ election_id: 'e1', detail: { positions: [] } });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });
});

describe('XLSX — flattenResults (compartido con CSV)', () => {
  it('produce 9 columnas por fila', () => {
    const rows = flattenResults({
      election_id: 'e1',
      detail: {
        positions: [
          {
            position_id: 'p1',
            position_name: 'P',
            seats: 1,
            options: [
              { option_id: 'o1', label: 'L', option_type: 'CANDIDATE_LIST', candidate_list_id: 'cl1', votes_count: 1, percentage: 100 },
            ],
          },
        ],
      },
    });
    expect(rows[0]).toHaveLength(9);
  });
});
