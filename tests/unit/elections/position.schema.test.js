import {
  createPositionSchema,
  updatePositionSchema,
  positionParamsSchema,
} from '../../../src/modules/elections/positions/position.schema.js';

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


describe('Position Schema — cargos', () => {
  const params = { electionId: UUID };

  it('acepta un cargo válido', () => {
    expect(
      errorDe(
        createPositionSchema,
        envolver({ params, body: { name: 'Presidente', seats: 2 } })
      )
    ).toBeNull();
  });

  it('acepta omitir seats (lo cubre el DEFAULT de la BD)', () => {
    expect(
      errorDe(createPositionSchema, envolver({ params, body: { name: 'Presidente' } }))
    ).toBeNull();
  });

  it('rechaza un nombre en blanco (chk_positions_name_not_empty)', () => {
    const error = errorDe(
      createPositionSchema,
      envolver({ params, body: { name: '   ' } })
    );
    expect(error.campo).toBe('body.name');
  });

  it('rechaza más de 120 caracteres', () => {
    const error = errorDe(
      createPositionSchema,
      envolver({ params, body: { name: 'a'.repeat(121) } })
    );
    expect(error.campo).toBe('body.name');
  });

  it('rechaza seats = 0 (chk_positions_seats_positive)', () => {
    const error = errorDe(
      createPositionSchema,
      envolver({ params, body: { name: 'X', seats: 0 } })
    );
    expect(error.mensaje).toContain('al menos 1 plaza');
  });

  it('rechaza seats decimal', () => {
    const error = errorDe(
      createPositionSchema,
      envolver({ params, body: { name: 'X', seats: 1.5 } })
    );
    expect(error.mensaje).toContain('entero');
  });

  it('rechaza seats por encima del rango de SMALLINT', () => {
    const error = errorDe(
      createPositionSchema,
      envolver({ params, body: { name: 'X', seats: 40000 } })
    );
    expect(error.campo).toBe('body.seats');
  });

  it('convierte seats numérico enviado como texto', () => {
    const datos = datosDe(
      createPositionSchema,
      envolver({ params, body: { name: 'X', seats: '3' } })
    );
    expect(datos.body.seats).toBe(3);
  });

  it('la actualización exige al menos un campo', () => {
    const error = errorDe(
      updatePositionSchema,
      envolver({ params: { electionId: UUID, id: OTRO }, body: {} })
    );
    expect(error.mensaje).toContain('Al menos un campo');
  });

  it('los parámetros exigen ambos UUID', () => {
    const error = errorDe(
      positionParamsSchema,
      envolver({ params: { electionId: UUID, id: 'abc' } })
    );
    expect(error.campo).toBe('params.id');
  });
});

