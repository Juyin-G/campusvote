/**
 * Flujo completo de la plataforma con Tecsup — HTTP + BD real (PostgreSQL).
 *
 * Recorre el sistema como en la vida real, de punta a punta:
 *   1. Tecsup solicita la plataforma y el SUPERADMIN la aprueba.
 *   2. El admin de Tecsup activa su cuenta (contraseña + 2FA) y se crea la
 *      organización.
 *   3. El admin da de alta docentes, carga alumnos y jurados, y arma la feria
 *      (categorías, stands, rúbrica, jurados) y la abre.
 *   4. Los docentes inscriben proyectos y agregan a sus alumnos por correo.
 *   5. El admin revisa las inscripciones (rechaza una, se corrige y se
 *      aprueba) y asigna stands.
 *   6. Empieza la feria: el jurado declara, evalúa y la feria se cierra.
 *   7. Se publican los resultados con su ganador.
 *   8. Aislamiento: UPAO, otra institución de la plataforma, no ve ni toca
 *      nada de Tecsup (y viceversa).
 *
 * Cada `it` es un paso y depende de los anteriores.
 */
import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { generateSync } from 'otplib';

// El correo se simula: se guardan los enlaces de activación para usarlos.
const activaciones = new Map();

jest.unstable_mockModule('../../src/shared/services/email.service.js', () => ({
  hasEmailConfigured: jest.fn().mockReturnValue(true),
  sendVerification: jest.fn().mockResolvedValue(true),
  sendReset: jest.fn().mockResolvedValue(true),
  sendRequestReceived: jest.fn().mockResolvedValue(true),
  sendAdminActivation: jest.fn(async ({ email, token }) => {
    activaciones.set(email, token);
  }),
}));

jest.unstable_mockModule('../../src/middlewares/rateLimiter.middleware.js', () => ({
  loginLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  userLimiter: () => (_req, _res, next) => next(),
  userElectionLimiter: () => (_req, _res, next) => next(),
}));

const app = (await import('../../src/app.js')).default;
const { prisma } = await import('../../src/database/prisma.js');

const runId = Date.now();
const CLAVE = 'TecsupFeria2026!';
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

// DNI de 8 dígitos, distinto en cada corrida.
let dniSiguiente = 10000000 + (runId % 80000000);
const dni = () => String(dniSiguiente++).slice(-8);

const correoTecsup = (usuario) => `${usuario}.${runId}@tecsup.edu.pe`;
const correoUpao = (usuario) => `${usuario}.${runId}@upao.edu.pe`;

const api = (metodo, url, token) => {
  const req = request(app)[metodo](url);
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

const codigo2fa = (secret) => generateSync({ secret });

const login = async (email, password = CLAVE) => {
  const res = await api('post', '/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.body.data.token;
};

/**
 * Solicitud → aprobación del SUPERADMIN → activación del admin con 2FA.
 * Devuelve el token del admin, su organización y su secreto 2FA.
 */
const darDeAltaInstitucion = async ({ nombre, tipo, correoAdmin, superToken }) => {
  const solicitud = await api('post', '/api/organizations/requests').send({
    institution_name: nombre,
    institution_type: tipo,
    country: 'Perú',
    estimated_members: 500,
    contact_email: correoAdmin,
    message: 'Queremos usar CampusVote para nuestras ferias y elecciones.',
  });
  expect(solicitud.status).toBe(201);

  const aprobacion = await api(
    'patch',
    `/api/organizations/requests/${solicitud.body.data.id}/approve`,
    superToken
  );
  expect(aprobacion.status).toBe(200);
  expect(aprobacion.body.data.activation_email_sent).toBe(true);

  const token = activaciones.get(correoAdmin);
  expect(token).toBeDefined();

  const activacion = await api('post', '/api/auth/onboarding/activate').send({
    token,
    new_password: CLAVE,
  });
  expect(activacion.status).toBe(200);
  const onboardingToken = activacion.body.data.tempToken;

  const qr = await api('post', '/api/auth/onboarding/totp/setup', onboardingToken);
  expect(qr.status).toBe(200);
  const secret = qr.body.data.secret;

  const verificado = await api('post', '/api/auth/onboarding/totp/verify', onboardingToken).send({
    code: codigo2fa(secret),
  });
  expect(verificado.status).toBe(200);

  const final = await api('post', '/api/auth/onboarding/finalize', onboardingToken);
  expect(final.status).toBe(200);
  expect(final.body.data.user.role).toBe('ADMIN');

  return {
    adminToken: final.body.data.token,
    organizationId: final.body.data.user.organization_id,
    secret,
  };
};

// Estado compartido entre los pasos.
const t = {};

describe('Flujo completo con Tecsup (HTTP + DB)', () => {
  beforeAll(async () => {
    // La plataforma arranca con su SUPERADMIN (en producción: bootstrap).
    const superAdmin = await prisma.user.create({
      data: {
        username: `plataforma.super.${runId}`,
        email: `super.${runId}@campusvote.pe`,
        password: await bcrypt.hash(CLAVE, 12),
        firstName: 'Dueña',
        lastName: 'Plataforma',
        institutionalId: `SUPER${runId}`,
        role: 'SUPERADMIN',
        authProvider: 'LOCAL',
        isVerified: true,
        isStaff: true,
        isSuperuser: true,
        status: 'ACTIVE',
        mustChangePassword: false,
      },
    });
    t.superToken = await login(superAdmin.email);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ── 1-2. Alta de la institución ────────────────────────────────────

  it('1. Tecsup solicita la plataforma, la superadmin aprueba y el admin activa su cuenta con 2FA', async () => {
    const tecsup = await darDeAltaInstitucion({
      nombre: `Tecsup Sede Norte ${runId}`,
      tipo: 'INSTITUTE',
      correoAdmin: correoTecsup('admin'),
      superToken: t.superToken,
    });
    Object.assign(t, {
      adminToken: tecsup.adminToken,
      tecsupId: tecsup.organizationId,
      adminSecret: tecsup.secret,
    });

    const org = await prisma.organization.findUnique({ where: { id: t.tecsupId } });
    expect(org.name).toBe(`Tecsup Sede Norte ${runId}`);
    expect(org.orgType).toBe('INSTITUTE');
  });

  it('2. el admin de Tecsup vuelve a entrar con contraseña + código 2FA', async () => {
    const paso1 = await api('post', '/api/auth/login').send({
      email: correoTecsup('admin'),
      password: CLAVE,
    });
    expect(paso1.status).toBe(200);
    expect(paso1.body.data.requiresTotp).toBe(true);

    const paso2 = await api('post', '/api/auth/totp/login-verify', paso1.body.data.tempToken).send({
      code: codigo2fa(t.adminSecret),
    });
    expect(paso2.status).toBe(200);
    expect(paso2.body.data.token).toBeDefined();
    t.adminToken = paso2.body.data.token;
  });

  it('3. una solicitud sospechosa se rechaza con motivo y ya no se puede aprobar', async () => {
    const spam = await api('post', '/api/organizations/requests').send({
      institution_name: 'Instituto Fantasma',
      institution_type: 'OTHER',
      country: 'Perú',
      estimated_members: 10,
      contact_email: `fantasma.${runId}@correo.com`,
    });
    expect(spam.status).toBe(201);

    const rechazo = await api('patch', `/api/organizations/requests/${spam.body.data.id}/reject`, t.superToken).send({
      rejection_reason: 'No se pudo verificar la institución',
    });
    expect(rechazo.status).toBe(200);

    const aprobarDespues = await api(
      'patch',
      `/api/organizations/requests/${spam.body.data.id}/approve`,
      t.superToken
    );
    expect(aprobarDespues.status).toBe(409);
  });

  // ── 3. El admin arma su institución ────────────────────────────────

  it('4. el admin da de alta a dos docentes (sin facultad: Tecsup no las usa)', async () => {
    for (const [clave, nombre] of [
      ['docente1', 'Carla'],
      ['docente2', 'Miguel'],
    ]) {
      const res = await api('post', '/api/users', t.adminToken).send({
        username: `tecsup.${clave}.${runId}`,
        email: correoTecsup(clave),
        password: CLAVE,
        first_name: nombre,
        last_name: 'Docente',
        institutional_id: `TD${clave}${runId}`.slice(0, 50),
        role: 'TEACHER',
        organization_id: t.tecsupId,
        document_type: 'DNI',
        document_number: dni(),
      });
      expect(res.status).toBe(201);
      t[`${clave}Token`] = await login(correoTecsup(clave));
    }
  });

  it('5. el admin carga alumnos y jurados en lote', async () => {
    const alumnos = ['alumno1', 'alumno2', 'alumno3', 'alumno4'].map((clave) => ({
      username: `tecsup.${clave}.${runId}`,
      email: correoTecsup(clave),
      password: CLAVE,
      first_name: clave,
      last_name: 'Tecsup',
      role: 'STUDENT',
      must_change_password: false,
    }));
    const jurados = ['jurado1', 'jurado2'].map((clave) => ({
      username: `tecsup.${clave}.${runId}`,
      email: correoTecsup(clave),
      password: CLAVE,
      first_name: clave,
      last_name: 'Jurado',
      role: 'JURY',
      document_type: 'DNI',
      document_number: dni(),
      must_change_password: false,
    }));

    const res = await api('post', '/api/users/bulk', t.adminToken).send({ users: [...alumnos, ...jurados] });
    expect(res.status).toBe(201);
    expect(res.body.data.totalOk).toBe(6);
    expect(res.body.data.totalFailed).toBe(0);

    for (const creado of res.body.data.created) {
      expect(creado.organization_id).toBe(t.tecsupId);
    }
    t.jurado1 = res.body.data.created.find((u) => u.email === correoTecsup('jurado1'));
    t.jurado2 = res.body.data.created.find((u) => u.email === correoTecsup('jurado2'));
    t.alumno1Token = await login(correoTecsup('alumno1'));
    t.jurado1Token = await login(correoTecsup('jurado1'));
    t.jurado2Token = await login(correoTecsup('jurado2'));
  });

  it('6. el admin crea la feria con categorías, stands, rúbrica y jurados', async () => {
    const feria = await api('post', '/api/fairs', t.adminToken).send({
      name: `Feria de Innovación Tecsup ${runId}`,
      description: 'Proyectos integradores del ciclo 2026-II',
      starts_at: new Date(Date.now() + 3 * DIA).toISOString(),
      ends_at: new Date(Date.now() + 4 * DIA).toISOString(),
    });
    expect(feria.status).toBe(201);
    expect(feria.body.data.status).toBe('DRAFT');
    t.feriaId = feria.body.data.id;

    const categorias = {};
    for (const nombre of ['Software', 'Robótica e IoT']) {
      const res = await api('post', `/api/fairs/${t.feriaId}/categories`, t.adminToken).send({ name: nombre });
      expect(res.status).toBe(201);
      categorias[nombre] = res.body.data.id;
    }
    t.catSoftware = categorias.Software;
    t.catRobotica = categorias['Robótica e IoT'];

    const stands = [];
    for (const code of ['A-01', 'A-02']) {
      const res = await api('post', `/api/fairs/${t.feriaId}/stands`, t.adminToken).send({ code });
      expect(res.status).toBe(201);
      stands.push(res.body.data.id);
    }
    [t.standA01, t.standA02] = stands;

    const rubrica = await api('post', `/api/fairs/${t.feriaId}/rubric`, t.adminToken).send({
      name: 'Rúbrica Tecsup 2026',
    });
    expect(rubrica.status).toBe(201);
    for (const [position, name] of [
      [1, 'Innovación'],
      [2, 'Viabilidad técnica'],
    ]) {
      const res = await api('post', `/api/fairs/${t.feriaId}/rubric/criteria`, t.adminToken).send({
        name,
        min_score: 0,
        max_score: 10,
        position,
      });
      expect(res.status).toBe(201);
    }
    const detalle = await api('get', `/api/fairs/${t.feriaId}/rubric`, t.adminToken);
    expect(detalle.status).toBe(200);
    t.criterios = detalle.body.data.criteria.map((c) => c.id);
    expect(t.criterios).toHaveLength(2);

    for (const jurado of [t.jurado1, t.jurado2]) {
      const res = await api('post', `/api/fairs/${t.feriaId}/juries`, t.adminToken).send({ user_id: jurado.id });
      expect(res.status).toBe(201);
    }
  });

  it('7. el admin abre la feria y la inscripción cierra 24 h antes del inicio', async () => {
    const res = await api('post', `/api/fairs/${t.feriaId}/status`, t.adminToken).send({ status: 'OPEN' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('OPEN');

    const feria = await api('get', `/api/fairs/${t.feriaId}`, t.adminToken);
    const inicio = new Date(feria.body.data.starts_at).getTime();
    expect(new Date(feria.body.data.registration_closes_at).getTime()).toBe(inicio - DIA);
  });

  // ── 4. Inscripción por los docentes ────────────────────────────────

  it('8. el docente ve la feria en el catálogo con sus categorías', async () => {
    const res = await api('get', '/api/projects/catalog', t.docente1Token);
    expect(res.status).toBe(200);
    const feria = res.body.data.find((f) => f.id === t.feriaId);
    expect(feria).toBeDefined();
    expect(feria.categories.map((c) => c.name).sort()).toEqual(['Robótica e IoT', 'Software']);
  });

  it('9. la docente Carla inscribe su proyecto y agrega a dos alumnos por correo', async () => {
    const proyecto = await api('post', '/api/projects', t.docente1Token).send({
      fair_id: t.feriaId,
      category_id: t.catRobotica,
      name: 'Brazo robótico para laboratorio',
      description: 'Brazo de 4 ejes controlado por visión artificial',
      cover_url: 'https://images.unsplash.com/photo-1561557944-6e7860d1a7eb',
    });
    expect(proyecto.status).toBe(201);
    t.proyecto1 = proyecto.body.data.id;

    for (const alumno of ['alumno1', 'alumno2']) {
      const res = await api('post', `/api/projects/${t.proyecto1}/members`, t.docente1Token).send({
        email: correoTecsup(alumno),
        role: 'EXPOSITOR',
      });
      expect(res.status).toBe(201);
    }
  });

  it('10. el docente Miguel inscribe otro proyecto; un alumno de Carla no puede estar en dos', async () => {
    const proyecto = await api('post', '/api/projects', t.docente2Token).send({
      fair_id: t.feriaId,
      category_id: t.catSoftware,
      name: 'App de asistencia con QR',
    });
    expect(proyecto.status).toBe(201);
    t.proyecto2 = proyecto.body.data.id;

    const repetido = await api('post', `/api/projects/${t.proyecto2}/members`, t.docente2Token).send({
      email: correoTecsup('alumno1'),
    });
    expect(repetido.status).toBe(409);

    const ok = await api('post', `/api/projects/${t.proyecto2}/members`, t.docente2Token).send({
      email: correoTecsup('alumno3'),
    });
    expect(ok.status).toBe(201);
  });

  it('11. el alumno ve el proyecto en el que expone, pero no puede editarlo ni inscribir otro', async () => {
    const lista = await api('get', '/api/projects', t.alumno1Token);
    expect(lista.status).toBe(200);
    expect(lista.body.data.map((p) => p.id)).toContain(t.proyecto1);

    const editar = await api('put', `/api/projects/${t.proyecto1}`, t.alumno1Token).send({ name: 'Otro' });
    expect(editar.status).toBe(403);

    const crear = await api('post', '/api/projects', t.alumno1Token).send({ fair_id: t.feriaId, name: 'Mío' });
    expect(crear.status).toBe(403);
  });

  it('12. ambos docentes envían sus inscripciones a revisión', async () => {
    for (const [id, token] of [
      [t.proyecto1, t.docente1Token],
      [t.proyecto2, t.docente2Token],
    ]) {
      const res = await api('post', `/api/projects/${id}/submit`, token);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SUBMITTED');
    }
  });

  // ── 5. Revisión de la inscripción y stands ─────────────────────────

  it('13. el admin rechaza una inscripción con motivo; el docente corrige y reenvía', async () => {
    const rechazo = await api('post', `/api/projects/${t.proyecto2}/review`, t.adminToken).send({
      decision: 'REJECTED',
      review_notes: 'Falta la descripción del proyecto',
    });
    expect(rechazo.status).toBe(200);
    expect(rechazo.body.data.status).toBe('REJECTED');

    const correccion = await api('put', `/api/projects/${t.proyecto2}`, t.docente2Token).send({
      description: 'Registro de asistencia con códigos QR dinámicos por sesión',
    });
    expect(correccion.status).toBe(200);
    expect(correccion.body.data.status).toBe('DRAFT');

    const reenvio = await api('post', `/api/projects/${t.proyecto2}/submit`, t.docente2Token);
    expect(reenvio.status).toBe(200);
  });

  it('14. el admin aprueba ambas inscripciones y asigna los stands', async () => {
    for (const id of [t.proyecto1, t.proyecto2]) {
      const res = await api('post', `/api/projects/${id}/review`, t.adminToken).send({ decision: 'APPROVED' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');
    }

    const a01 = await api('put', `/api/projects/${t.proyecto1}/stand`, t.adminToken).send({ stand_id: t.standA01 });
    expect(a01.status).toBe(200);
    expect(a01.body.data.stand.code).toBe('A-01');

    const ocupado = await api('put', `/api/projects/${t.proyecto2}/stand`, t.adminToken).send({ stand_id: t.standA01 });
    expect(ocupado.status).toBe(409);

    const a02 = await api('put', `/api/projects/${t.proyecto2}/stand`, t.adminToken).send({ stand_id: t.standA02 });
    expect(a02.status).toBe(200);
  });

  // ── 6. Día de la feria ─────────────────────────────────────────────

  it('15. el jurado firma su declaración, pero no puede evaluar antes del inicio', async () => {
    for (const token of [t.jurado1Token, t.jurado2Token]) {
      const res = await api('post', `/api/fairs/${t.feriaId}/jury/declaration`, token).send({
        statement: 'Declaro no tener conflicto de interés con los proyectos de esta feria.',
      });
      expect(res.status).toBe(201);
    }

    const temprano = await api('post', `/api/fairs/${t.feriaId}/evaluations`, t.jurado1Token).send({
      project_id: t.proyecto1,
      scores: t.criterios.map((criterion_id) => ({ criterion_id, score: 8 })),
    });
    expect(temprano.status).toBe(409);
  });

  it('16. llega el día: empieza la feria y la inscripción queda congelada', async () => {
    const res = await api('put', `/api/fairs/${t.feriaId}`, t.adminToken).send({
      starts_at: new Date(Date.now() - HORA).toISOString(),
      ends_at: new Date(Date.now() + 6 * HORA).toISOString(),
    });
    expect(res.status).toBe(200);

    const tarde = await api('post', '/api/projects', t.docente1Token).send({
      fair_id: t.feriaId,
      name: 'Proyecto de último minuto',
    });
    expect(tarde.status).toBe(409);

    const catalogo = await api('get', '/api/projects/catalog', t.docente1Token);
    expect(catalogo.body.data.map((f) => f.id)).not.toContain(t.feriaId);
  });

  it('17. el jurado ve los proyectos aprobados con su stand y los evalúa', async () => {
    const lista = await api('get', `/api/fairs/${t.feriaId}/projects`, t.jurado1Token);
    expect(lista.status).toBe(200);
    expect(lista.body.data.map((p) => p.id).sort()).toEqual([t.proyecto1, t.proyecto2].sort());

    const notas = [
      [t.jurado1Token, t.proyecto1, [9, 8]],
      [t.jurado2Token, t.proyecto1, [10, 9]],
      [t.jurado1Token, t.proyecto2, [7, 8]],
      [t.jurado2Token, t.proyecto2, [8, 8]],
    ];
    for (const [token, projectId, puntajes] of notas) {
      const res = await api('post', `/api/fairs/${t.feriaId}/evaluations`, token).send({
        project_id: projectId,
        scores: t.criterios.map((criterion_id, i) => ({ criterion_id, score: puntajes[i] })),
        comment: 'Buen trabajo del equipo',
      });
      expect(res.status).toBe(201);
    }

    const repetida = await api('post', `/api/fairs/${t.feriaId}/evaluations`, t.jurado1Token).send({
      project_id: t.proyecto1,
      scores: t.criterios.map((criterion_id) => ({ criterion_id, score: 10 })),
    });
    expect(repetida.status).toBe(409);
  });

  it('17b. la app del jurado: ferias asignadas, filtros, detalle, avance y edición de su evaluación', async () => {
    const token = t.jurado1Token;

    // Pantalla "Mis ferias".
    const asignaciones = await api('get', '/api/fairs/my-assignments', token);
    expect(asignaciones.status).toBe(200);
    expect(asignaciones.body.data.map((a) => a.fair.id)).toContain(t.feriaId);
    expect((await api('get', `/api/fairs/my-assignments/${t.feriaId}`, token)).status).toBe(200);

    // Rúbrica y filtros (categorías y stands).
    const rubrica = await api('get', `/api/fairs/${t.feriaId}/rubric`, token);
    expect(rubrica.status).toBe(200);
    expect(rubrica.body.data.criteria).toHaveLength(2);
    const categorias = await api('get', `/api/fairs/${t.feriaId}/categories`, token);
    expect(categorias.status).toBe(200);
    expect(categorias.body.data.categories).toHaveLength(2);
    const stands = await api('get', `/api/fairs/${t.feriaId}/stands`, token);
    expect(stands.status).toBe(200);
    expect(stands.body.data.stands).toHaveLength(2);

    // Búsqueda y filtros de la lista de proyectos.
    const ids = async (query) =>
      (await api('get', `/api/fairs/${t.feriaId}/projects?${query}`, token)).body.data.map((p) => p.id);
    expect(await ids(`category_id=${t.catRobotica}`)).toEqual([t.proyecto1]);
    expect(await ids(`stand_id=${t.standA02}`)).toEqual([t.proyecto2]);
    expect(await ids('search=brazo')).toEqual([t.proyecto1]);

    // Las tarjetas de la lista ya traen portada, categoría y stand.
    const tarjeta = (await api('get', `/api/fairs/${t.feriaId}/projects?search=brazo`, token)).body.data[0];
    expect(tarjeta.cover_url).toContain('unsplash');
    expect(tarjeta.category).toEqual({ id: t.catRobotica, name: 'Robótica e IoT' });
    expect(tarjeta.stand).toEqual({ id: t.standA01, code: 'A-01' });

    // Detalle del proyecto: portada, categoría, stand e integrantes.
    const detalle = await api('get', `/api/fairs/${t.feriaId}/projects/${t.proyecto1}`, token);
    expect(detalle.status).toBe(200);
    expect(detalle.body.data.cover_url).toContain('unsplash');
    expect(JSON.stringify(detalle.body.data)).toContain('A-01');
    expect(JSON.stringify(detalle.body.data)).toContain('Robótica e IoT');
    expect(detalle.body.data.members.length).toBeGreaterThanOrEqual(2);

    // Mi avance y mis evaluaciones.
    const avance = await api('get', `/api/fairs/my-progress/${t.feriaId}`, token);
    expect(avance.status).toBe(200);
    expect(avance.body.data).toMatchObject({ total_projects: 2, evaluated_projects: 2 });

    const mias = await api('get', `/api/fairs/my-evaluations?fair_id=${t.feriaId}`, token);
    expect(mias.status).toBe(200);
    expect(mias.body.data).toHaveLength(2);

    // Corrige su comentario (sin tocar las notas); otro jurado no puede.
    const evaluacion = mias.body.data.find((e) => e.project_id === t.proyecto1);
    const editar = await api('put', `/api/fairs/${t.feriaId}/evaluations/${evaluacion.id}`, token).send({
      comment: 'Excelente integración de visión artificial',
    });
    expect(editar.status).toBe(200);

    const ajeno = await api('put', `/api/fairs/${t.feriaId}/evaluations/${evaluacion.id}`, t.jurado2Token).send({
      comment: 'Intento de editar lo ajeno',
    });
    expect([403, 404]).toContain(ajeno.status);

    // El jurado no ve los resultados de la feria.
    expect((await api('get', `/api/fairs/${t.feriaId}/results`, token)).status).toBe(403);
  });

  // ── 7. Resultados ──────────────────────────────────────────────────

  it('18. el admin cierra la feria; el ranking no tiene ganador hasta publicar', async () => {
    const cierre = await api('post', `/api/fairs/${t.feriaId}/status`, t.adminToken).send({ status: 'CLOSED' });
    expect(cierre.status).toBe(200);

    const res = await api('get', `/api/fairs/${t.feriaId}/results`, t.adminToken);
    expect(res.status).toBe(200);
    expect(res.body.data.published).toBe(false);
    const [primero, segundo] = res.body.data.ranking;
    expect(primero).toMatchObject({ project_id: t.proyecto1, average_score: 18, winner: false });
    expect(segundo).toMatchObject({ project_id: t.proyecto2, average_score: 15.5 });
  });

  it('19. el admin publica los resultados y el brazo robótico gana', async () => {
    const publicar = await api('post', `/api/fairs/${t.feriaId}/results/publish`, t.adminToken);
    expect(publicar.status).toBe(201);

    const res = await api('get', `/api/fairs/${t.feriaId}/results`, t.adminToken);
    expect(res.body.data.published).toBe(true);
    expect(res.body.data.ranking[0]).toMatchObject({
      project_id: t.proyecto1,
      project_name: 'Brazo robótico para laboratorio',
      winner: true,
    });
    expect(res.body.data.ranking[1].winner).toBe(false);
  });

  // ── 8. Aislamiento entre instituciones ─────────────────────────────

  it('20. UPAO entra a la plataforma con su propio admin', async () => {
    const upao = await darDeAltaInstitucion({
      nombre: `UPAO ${runId}`,
      tipo: 'UNIVERSITY',
      correoAdmin: correoUpao('admin'),
      superToken: t.superToken,
    });
    t.upaoAdminToken = upao.adminToken;
    t.upaoId = upao.organizationId;
    expect(t.upaoId).not.toBe(t.tecsupId);

    const alumno = await api('post', '/api/users/bulk', t.upaoAdminToken).send({
      users: [
        {
          username: `upao.alumno.${runId}`,
          email: correoUpao('alumno'),
          password: CLAVE,
          first_name: 'Alumno',
          last_name: 'UPAO',
          role: 'STUDENT',
        },
      ],
    });
    expect(alumno.status).toBe(201);
  });

  it('21. el admin de UPAO no ve la feria, los proyectos ni los resultados de Tecsup', async () => {
    const feria = await api('get', `/api/fairs/${t.feriaId}`, t.upaoAdminToken);
    expect(feria.status).toBe(403);

    const resultados = await api('get', `/api/fairs/${t.feriaId}/results`, t.upaoAdminToken);
    expect(resultados.status).toBe(403);

    const proyectos = await api('get', '/api/projects', t.upaoAdminToken);
    expect(proyectos.status).toBe(200);
    expect(proyectos.body.data.map((p) => p.id)).not.toContain(t.proyecto1);

    const detalle = await api('get', `/api/projects/${t.proyecto1}`, t.upaoAdminToken);
    expect(detalle.status).toBe(403);
  });

  it('22. el admin de UPAO no puede modificar los datos ni el onboarding de Tecsup', async () => {
    const identidad = await api('patch', `/api/organizations/${t.tecsupId}`, t.upaoAdminToken).send({
      name: 'Tecsup Hackeado',
    });
    expect(identidad.status).toBe(403);

    const onboarding = await api('patch', `/api/organizations/${t.tecsupId}/onboarding`, t.upaoAdminToken).send({
      name: 'Tecsup Hackeado',
    });
    expect(onboarding.status).toBe(403);

    const completar = await api('post', `/api/organizations/${t.tecsupId}/onboarding/complete`, t.upaoAdminToken);
    expect(completar.status).toBe(403);

    const org = await prisma.organization.findUnique({ where: { id: t.tecsupId } });
    expect(org.name).toBe(`Tecsup Sede Norte ${runId}`);
    expect(org.onboardingCompleted).toBe(false);
  });

  it('23. el admin de Tecsup completa su propio onboarding', async () => {
    const res = await api('post', `/api/organizations/${t.tecsupId}/onboarding/complete`, t.adminToken);
    expect(res.status).toBe(200);
  });

  it('24. un docente de Tecsup no puede agregar a un alumno de UPAO', async () => {
    const proyecto = await prisma.project.create({
      data: {
        organizationId: t.tecsupId,
        fairId: (
          await prisma.fair.create({
            data: {
              organizationId: t.tecsupId,
              name: `Feria de verano ${runId}`,
              status: 'OPEN',
              startsAt: new Date(Date.now() + 10 * DIA),
            },
          })
        ).id,
        createdById: (await prisma.user.findUnique({ where: { email: correoTecsup('docente1') } })).id,
        name: 'Proyecto de verano',
        status: 'DRAFT',
      },
    });

    const res = await api('post', `/api/projects/${proyecto.id}/members`, t.docente1Token).send({
      email: correoUpao('alumno'),
    });
    expect(res.status).toBe(400);
  });
});
