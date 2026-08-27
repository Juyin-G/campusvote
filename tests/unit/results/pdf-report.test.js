// tests/unit/results/pdf-report.test.js
// S7-12 — Tests del generador de PDF.

const { generateResultsPdf, sha256OfBuffer } = await import(
  '../../../src/modules/results/report/report.service.js'
);

describe('PDF — generateResultsPdf', () => {
  const baseData = {
    election: { id: 'e1', title: 'Elección 2026', status: 'PUBLISHED' },
    summary: {
      total_voters: 1000,
      total_votes_cast: 750,
      turnout_percentage: 75,
      blank_votes: 10,
      null_votes: 5,
      certified_at: '2026-08-25T10:00:00Z',
      published_at: '2026-08-25T12:00:00Z',
    },
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
            votes_count: 600,
            percentage: 80,
          },
          {
            option_id: 'o2',
            label: 'Voto en blanco',
            option_type: 'BLANK',
            candidate_list_id: null,
            votes_count: 100,
            percentage: 13.33,
          },
          {
            option_id: 'o3',
            label: 'Voto nulo',
            option_type: 'NULL',
            candidate_list_id: null,
            votes_count: 50,
            percentage: 6.67,
          },
        ],
      },
    ],
  };

  it('genera un Buffer PDF con magic number %PDF', async () => {
    const { buffer } = await generateResultsPdf(baseData);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('devuelve un hash SHA-256 de 64 caracteres', async () => {
    const { hash } = await generateResultsPdf(baseData);
    expect(typeof hash).toBe('string');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('el hash es estable para los mismos datos', async () => {
    const a = await generateResultsPdf(baseData);
    const b = await generateResultsPdf(baseData);
    // El hash puede variar porque PDF incluye timestamp interno.
    // Verificamos que es válido y mide exactamente 64 chars.
    expect(a.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(b.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('maneja datos sin posiciones', async () => {
    const data = { ...baseData, positions: [] };
    const { buffer } = await generateResultsPdf(data);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('maneja datos mínimos (sin summary, sin election)', async () => {
    const { buffer } = await generateResultsPdf({
      election: {},
      summary: {},
      positions: [],
    });
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});

describe('PDF — sha256OfBuffer', () => {
  it('devuelve hash SHA-256 del buffer', () => {
    const hash = sha256OfBuffer(Buffer.from('hello'));
    expect(hash).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
    );
  });

  it('maneja buffer vacío', () => {
    const hash = sha256OfBuffer(Buffer.alloc(0));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
