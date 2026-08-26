import {
  createCandidateListSchema,
  updateCandidateListSchema,
} from '../../../src/modules/elections/candidateList.schema.js';
import {
  createCandidacySchema,
  updateCandidacySchema,
  listCandidacySchema,
} from '../../../src/modules/elections/candidacy.schema.js';
import {
  createElectionRulesSchema,
  updateElectionRulesSchema,
} from '../../../src/modules/elections/electionRules.schema.js';

const UUID = '3f0c2b1e-1c2d-4a5b-8c9d-0e1f2a3b4c5d';
const OTRO = '7a2b9c4d-3e5f-4a6b-9c8d-1e2f3a4b5c6d';

const envolver = ({ body = {}, query = {}, params = {} } = {}) => ({
  body,
  query,
  params,
});

const errorDe = (schema, valor) => {
  const r = schema.safeParse(valor);
  if (r.success) return null;
  const issue = r.error.issues[0];
  return { campo: issue.path.join('.'), mensaje: issue.message };
};

const datosDe = (schema, valor) => schema.safeParse(valor).data;

describe('CandidateList Schema — listas candidatas', () => {
  const params = { electionId: UUID };

  it('acepta solo el nombre', () => {
    expect(
      errorDe(createCandidateListSchema, envolver({ params, body: { name: 'Unidad' } }))
    ).toBeNull();
  });

  it('acepta acronym vacío (el service lo convierte a null)', () => {
    expect(
      errorDe(
        createCandidateListSchema,
        envolver({ params, body: { name: 'Unidad', acronym: '' } })
      )
    ).toBeNull();
  });

  it('acepta null explícito para limpiar el campo', () => {
    expect(
      errorDe(
        createCandidateListSchema,
        envolver({ params, body: { name: 'Unidad', motto: null } })
      )
    ).toBeNull();
  });

  it('rechaza un nombre en blanco', () => {
    const error = errorDe(
      createCandidateListSchema,
      envolver({ params, body: { name: '  ' } })
    );
    expect(error.campo).toBe('body.name');
  });

  it('respeta los límites de la BD: acronym 20, motto 255, logo 500', () => {
    expect(
      errorDe(
        createCandidateListSchema,
        envolver({ params, body: { name: 'X', acronym: 'a'.repeat(21) } })
      ).campo
    ).toBe('body.acronym');

    expect(
      errorDe(
        createCandidateListSchema,
        envolver({ params, body: { name: 'X', motto: 'a'.repeat(256) } })
      ).campo
    ).toBe('body.motto');

    expect(
      errorDe(
        createCandidateListSchema,
        envolver({ params, body: { name: 'X', logo: 'a'.repeat(501) } })
      ).campo
    ).toBe('body.logo');
  });

  it('la actualización exige al menos un campo', () => {
    const error = errorDe(
      updateCandidateListSchema,
      envolver({ params: { electionId: UUID, id: OTRO }, body: {} })
    );
    expect(error).not.toBeNull();
  });
});

describe('Candidacy Schema — candidaturas', () => {
  const params = { electionId: UUID };

  it('exige candidate_list_id y user_id', () => {
    expect(
      errorDe(createCandidacySchema, envolver({ params, body: { user_id: UUID } })).campo
    ).toBe('body.candidate_list_id');

    expect(
      errorDe(
        createCandidacySchema,
        envolver({ params, body: { candidate_list_id: UUID } })
      ).campo
    ).toBe('body.user_id');
  });

  it('permite candidatura sin cargo asignado', () => {
    expect(
      errorDe(
        createCandidacySchema,
        envolver({ params, body: { candidate_list_id: UUID, user_id: OTRO } })
      )
    ).toBeNull();
  });

  it('rechaza order_index = 0 (chk_candidacies_order_positive)', () => {
    const error = errorDe(
      createCandidacySchema,
      envolver({
        params,
        body: { candidate_list_id: UUID, user_id: OTRO, order_index: 0 },
      })
    );
    expect(error.mensaje).toContain('1 o mayor');
  });

  it('descarta user_id en la actualización', () => {
    const datos = datosDe(
      updateCandidacySchema,
      envolver({
        params: { electionId: UUID, id: OTRO },
        body: { user_id: UUID, order_index: 2 },
      })
    );

    expect(datos.body).toEqual({ order_index: 2 });
    expect(datos.body.user_id).toBeUndefined();
  });

  it('el listado admite filtros por lista y por cargo', () => {
    expect(
      errorDe(
        listCandidacySchema,
        envolver({ params, query: { candidate_list_id: UUID, position_id: OTRO } })
      )
    ).toBeNull();
  });
});

describe('ElectionRules Schema — reglas', () => {
  const params = { electionId: UUID };

  it('acepta un body vacío (todos los campos tienen DEFAULT)', () => {
    expect(errorDe(createElectionRulesSchema, envolver({ params, body: {} }))).toBeNull();
  });

  it('acepta un quórum con 2 decimales', () => {
    expect(
      errorDe(
        createElectionRulesSchema,
        envolver({ params, body: { min_turnout_percentage: 33.33 } })
      )
    ).toBeNull();
  });

  it('rechaza más de 2 decimales (NUMERIC(5,2) redondearía en silencio)', () => {
    const error = errorDe(
      createElectionRulesSchema,
      envolver({ params, body: { min_turnout_percentage: 33.333 } })
    );
    expect(error.mensaje).toContain('2 decimales');
  });

  it('rechaza quórum fuera de 0-100 (chk_election_rules_turnout)', () => {
    expect(
      errorDe(
        createElectionRulesSchema,
        envolver({ params, body: { min_turnout_percentage: 101 } })
      ).campo
    ).toBe('body.min_turnout_percentage');

    expect(
      errorDe(
        createElectionRulesSchema,
        envolver({ params, body: { min_turnout_percentage: -1 } })
      ).campo
    ).toBe('body.min_turnout_percentage');
  });

  it('rechaza max_positions_per_ballot = 0', () => {
    const error = errorDe(
      createElectionRulesSchema,
      envolver({ params, body: { max_positions_per_ballot: 0 } })
    );
    expect(error.mensaje).toContain('al menos 1 cargo');
  });

  it('exige booleanos reales en los flags', () => {
    const error = errorDe(
      createElectionRulesSchema,
      envolver({ params, body: { requires_2fa: 'si' } })
    );
    expect(error.campo).toBe('body.requires_2fa');
  });

  it('la actualización exige al menos un campo', () => {
    const error = errorDe(updateElectionRulesSchema, envolver({ params, body: {} }));
    expect(error).not.toBeNull();
  });
});
