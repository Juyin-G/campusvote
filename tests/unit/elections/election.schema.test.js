import {
  createElectionSchema,
  updateElectionSchema,
  listElectionSchema,
  electionParamsSchema,
  changeStatusSchema,
  STATUS_TYPES,
  SCOPE_TYPES,
  PROCESS_TYPES,
} from '../../../src/modules/elections/election.schema.js';

const UUID = '3f0c2b1e-1c2d-4a5b-8c9d-0e1f2a3b4c5d';
const OTRO_UUID = '7a2b9c4d-3e5f-4a6b-9c8d-1e2f3a4b5c6d';

const envolver = ({ body = {}, query = {}, params = {} } = {}) => ({
  body,
  query,
  params,
});

/** Devuelve el primer mensaje de error, o null si el schema aceptó el valor. */
const errorDe = (schema, valor) => {
  const r = schema.safeParse(valor);
  if (r.success) return null;
  const issue = r.error.issues[0];
  return { campo: issue.path.join('.'), mensaje: issue.message };
};

const eleccionBase = {
  title: 'Elecciones Generales 2026',
  election_type: 'UNIVERSITY',
  period_id: UUID,
  start_at: '2026-09-01T08:00:00Z',
  end_at: '2026-09-01T18:00:00Z',
};

describe('Election Schema — integridad de alcance (chk_elections_scope_integrity)', () => {
  const casos = [
    ['UNIVERSITY sin facultad ni programa', {}, true],
    ['UNIVERSITY con facultad', { faculty_id: UUID }, false],
    ['UNIVERSITY con programa', { program_id: UUID }, false],
    ['FACULTY con facultad', { election_type: 'FACULTY', faculty_id: UUID }, true],
    ['FACULTY sin facultad', { election_type: 'FACULTY' }, false],
    [
      'FACULTY con facultad y programa',
      { election_type: 'FACULTY', faculty_id: UUID, program_id: OTRO_UUID },
      false,
    ],
    [
      'PROGRAM con facultad y programa',
      { election_type: 'PROGRAM', faculty_id: UUID, program_id: OTRO_UUID },
      true,
    ],
    ['PROGRAM solo con facultad', { election_type: 'PROGRAM', faculty_id: UUID }, false],
    ['PROGRAM solo con programa', { election_type: 'PROGRAM', program_id: UUID }, false],
  ];

  it.each(casos)('%s', (_nombre, extra, deberiaPasar) => {
    const error = errorDe(
      createElectionSchema,
      envolver({ body: { ...eleccionBase, ...extra } })
    );

    if (deberiaPasar) {
      expect(error).toBeNull();
    } else {
      expect(error).not.toBeNull();
      expect(['faculty_id', 'program_id']).toContain(
        error.campo.replace('body.', '')
      );
    }
  });

  it('las tres combinaciones válidas cubren todos los alcances', () => {
    expect(SCOPE_TYPES).toEqual(['UNIVERSITY', 'FACULTY', 'PROGRAM']);
  });
});

describe('Election Schema — fechas (chk_elections_dates)', () => {
  it('rechaza fin anterior al inicio', () => {
    const error = errorDe(
      createElectionSchema,
      envolver({ body: { ...eleccionBase, end_at: '2026-08-01T08:00:00Z' } })
    );

    expect(error.campo).toBe('body.end_at');
    expect(error.mensaje).toContain('posterior');
  });

  it('rechaza fin igual al inicio (la BD exige end_at > start_at)', () => {
    const error = errorDe(
      createElectionSchema,
      envolver({ body: { ...eleccionBase, end_at: eleccionBase.start_at } })
    );

    expect(error).not.toBeNull();
  });

  it('rechaza una fecha que no es ISO-8601', () => {
    const error = errorDe(
      createElectionSchema,
      envolver({ body: { ...eleccionBase, start_at: 'mañana' } })
    );

    expect(error.campo).toBe('body.start_at');
  });

  it('acepta un rango válido', () => {
    expect(errorDe(createElectionSchema, envolver({ body: eleccionBase }))).toBeNull();
  });
});

describe('Election Schema — campos y enums', () => {
  it('rechaza un título en blanco', () => {
    const error = errorDe(
      createElectionSchema,
      envolver({ body: { ...eleccionBase, title: '    ' } })
    );

    expect(error.campo).toBe('body.title');
  });

  it('rechaza un título de más de 255 caracteres', () => {
    const error = errorDe(
      createElectionSchema,
      envolver({ body: { ...eleccionBase, title: 'a'.repeat(256) } })
    );

    expect(error.campo).toBe('body.title');
  });

  it('rechaza un process_type fuera del enum', () => {
    const error = errorDe(
      createElectionSchema,
      envolver({ body: { ...eleccionBase, process_type: 'SORTEO' } })
    );

    expect(error.campo).toBe('body.process_type');
  });

  it('acepta todos los process_type del enum', () => {
    for (const tipo of PROCESS_TYPES) {
      const error = errorDe(
        createElectionSchema,
        envolver({ body: { ...eleccionBase, process_type: tipo } })
      );
      expect(error).toBeNull();
    }
  });

  it('rechaza period_id que no es UUID', () => {
    const error = errorDe(
      createElectionSchema,
      envolver({ body: { ...eleccionBase, period_id: '123' } })
    );

    expect(error.campo).toBe('body.period_id');
  });
});

describe('Election Schema — actualización', () => {
  it('exige al menos un campo', () => {
    const error = errorDe(
      updateElectionSchema,
      envolver({ params: { id: UUID }, body: {} })
    );

    expect(error.mensaje).toContain('Al menos un campo');
  });

  it('permite actualizar un solo campo', () => {
    expect(
      errorDe(
        updateElectionSchema,
        envolver({ params: { id: UUID }, body: { title: 'Nuevo título' } })
      )
    ).toBeNull();
  });

  it('revalida el alcance solo si llega election_type', () => {
    // Sin election_type no se aplica la regla de alcance
    expect(
      errorDe(
        updateElectionSchema,
        envolver({ params: { id: UUID }, body: { faculty_id: UUID } })
      )
    ).toBeNull();

    // Con election_type sí
    const error = errorDe(
      updateElectionSchema,
      envolver({
        params: { id: UUID },
        body: { election_type: 'UNIVERSITY', faculty_id: UUID },
      })
    );
    expect(error).not.toBeNull();
  });
});

describe('Election Schema — workflow y parámetros', () => {
  it('acepta cada estado del enum', () => {
    for (const estado of STATUS_TYPES) {
      const error = errorDe(
        changeStatusSchema,
        envolver({ params: { id: UUID }, body: { status: estado } })
      );
      expect(error).toBeNull();
    }
  });

  it('rechaza un estado inventado', () => {
    const error = errorDe(
      changeStatusSchema,
      envolver({ params: { id: UUID }, body: { status: 'ANULADA' } })
    );

    expect(error.campo).toBe('body.status');
  });

  it('el enum de estados coincide con el workflow del enunciado', () => {
    expect(STATUS_TYPES).toEqual([
      'DRAFT',
      'SCHEDULED',
      'OPEN',
      'CLOSED',
      'CERTIFIED',
      'PUBLISHED',
    ]);
  });

  it('rechaza un id de ruta que no es UUID', () => {
    const error = errorDe(electionParamsSchema, envolver({ params: { id: 'abc' } }));

    expect(error.campo).toBe('params.id');
  });

  it('el listado acepta filtros válidos', () => {
    expect(
      errorDe(
        listElectionSchema,
        envolver({ query: { page: '2', limit: '50', status: 'OPEN' } })
      )
    ).toBeNull();
  });

  it('el listado rechaza un limit mayor a 100', () => {
    const error = errorDe(listElectionSchema, envolver({ query: { limit: '500' } }));

    expect(error.campo).toBe('query.limit');
  });
});
