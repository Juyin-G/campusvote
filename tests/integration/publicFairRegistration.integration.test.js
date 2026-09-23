/**
 * Inscripción pública de proyectos — pruebas de integración HTTP + BD real.
 *
 * Flujo completo de la página que el admin comparte por enlace:
 *   - El enlace no existe hasta que el admin lo habilita, y se apaga cuando él
 *     quiere o cuando vence el plazo de inscripción.
 *   - Quien entra demuestra que el correo institucional es suyo con un código
 *     de 6 dígitos; sin eso no puede inscribir nada.
 *   - El ESTUDIANTE se inscribe y agrega a sus compañeros (queda como
 *     responsable). El DOCENTE inscribe a sus alumnos cuando ellos no pueden.
 *   - La inscripción entra a revisión del admin; si la rechaza con
 *     observaciones, llegan por correo y se corrigen desde la misma página.
 *   - La página se pinta con el logo y los colores de la institución.
 */
import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import request from 'supertest';

// El correo se simula: aquí se capturan los códigos y los avisos de revisión.
const codigos = new Map();
const avisos = [];

jest.unstable_mockModule('../../src/shared/services/email.service.js', () => {
  const correo = {
    hasEmailConfigured: jest.fn().mockReturnValue(true),
    sendVerification: jest.fn().mockResolvedValue(true),
    sendReset: jest.fn().mockResolvedValue(true),
    sendRequestReceived: jest.fn().mockResolvedValue(true),
    sendAdminActivation: jest.fn().mockResolvedValue(true),
    sendFairRegistrationCode: jest.fn(async ({ email, code }) => {
      codigos.set(email.toLowerCase(), code);
    }),
    sendProjectReviewNotice: jest.fn(async (payload) => {
      avisos.push(payload);
    }),
  };
  return { ...correo, sendActivation: correo.sendAdminActivation, default: correo };
});

jest.unstable_mockModule('../../src/middlewares/rateLimiter.middleware.js', () => ({
  loginLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  userLimiter: () => (_req, _res, next) => next(),
  userElectionLimiter: () => (_req, _res, next) => next(),
}));

const app = (await import('../../src/app.js')).default;
const { prisma } = await import('../../src/database/prisma.js');

const PASSWORD = 'PublicaTest123!';
// Coste bajo a propósito: en pruebas solo hace falta que el hash valide, y
// 12 rondas por usuario saturan la CPU cuando corren todas las suites juntas.
const BCRYPT_ROUNDS = 4;
const runId = Date.now();
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

const tokens = {};
const users = {};
let orgA;
let orgB;
let feria;
let feriaVencida;
let feriaDocente;
let feriaB;
let categoria;
let enlace;
let enlaceVencido;
let enlaceDocente;
let enlaceB;

import jwt from 'jsonwebtoken';

const env = (await import('../../src/config/env.js')).default;

// Desde FASE 15 el login exige 2FA a todo rol que no sea SUPERADMIN, así que
// las pruebas que solo necesitan una sesión de ADMIN firman el token
// directamente (mismo criterio que tests/integration/tenant-isolation.test.js).
const makeToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      scopeLevel: user.scopeLevel ?? null,
    },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

const createUser = async ({ key, role, organizationId, conSesion = false }) => {
  const user = await prisma.user.create({
    data: {
      username: `pub.${key}.${runId}`,
      email: `pub.${key}.${runId}@campusvote.edu.pe`,
      password: await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS),
      firstName: 'Publica',
      lastName: key,
      institutionalId: `PUB${key}${runId}`.slice(0, 50),
      role,
      scopeLevel: role === 'ADMIN' ? 'ORG' : null,
      authProvider: 'LOCAL',
      isVerified: true,
      status: 'ACTIVE',
      mustChangePassword: false,
      organizationId,
    },
  });
  users[key] = user;
  if (conSesion) tokens[key] = makeToken(user);
  return user;
};

const api = (method, url, key) => {
  const req = request(app)[method](url);
  return key ? req.set('Authorization', `Bearer ${tokens[key]}`) : req;
};

/** Habilita (o apaga) el enlace público de una feria y devuelve su token. */
const habilitarEnlace = async (fairId, enabled = true) => {
  const res = await api('post', `/api/fairs/${fairId}/public-registration`, 'admin').send({
    enabled,
  });
  expect(res.status).toBe(200);
  const url = res.body.data.public_registration.url;
  return url ? url.split('/').pop() : null;
};

/** Pide el código por correo y lo canjea: devuelve el permiso temporal. */
const entrarComo = async (token, email) => {
  const pedido = await request(app)
    .post(`/api/public/inscripciones/${token}/codigo`)
    .send({ email });
  expect(pedido.status).toBe(200);

  const codigo = codigos.get(email.toLowerCase());
  expect(codigo).toMatch(/^\d{6}$/);

  const sesion = await request(app)
    .post(`/api/public/inscripciones/${token}/sesion`)
    .send({ email, code: codigo });
  expect(sesion.status).toBe(200);
  return sesion.body.data;
};

describe('Inscripción pública de proyectos (HTTP + BD)', () => {
  beforeAll(async () => {
    orgA = await prisma.organization.create({
      data: {
        name: `Org Pública A ${runId}`,
        code: `PUA${runId}`,
        logo: 'https://cdn.example.edu.pe/logo-tecsup.png',
        primaryColor: '#00AEEF',
        secondaryColor: '#003A5D',
      },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org Pública B ${runId}`, code: `PUB${runId}` },
    });

    await createUser({ key: 'admin', role: 'ADMIN', organizationId: orgA.id, conSesion: true });
    await createUser({ key: 'adminB', role: 'ADMIN', organizationId: orgB.id, conSesion: true });
    await createUser({ key: 'docente', role: 'TEACHER', organizationId: orgA.id });
    await createUser({ key: 'alumno1', role: 'STUDENT', organizationId: orgA.id });
    await createUser({ key: 'alumno2', role: 'STUDENT', organizationId: orgA.id });
    await createUser({ key: 'alumno3', role: 'STUDENT', organizationId: orgA.id });
    await createUser({ key: 'alumnoB', role: 'STUDENT', organizationId: orgB.id });

    const periodo = await prisma.academicPeriod.create({
      data: {
        organizationId: orgA.id,
        name: `2026-II ${runId}`,
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-12-20'),
      },
    });

    feria = await prisma.fair.create({
      data: {
        organizationId: orgA.id,
        academicPeriodId: periodo.id,
        name: `Feria de Proyectos ${runId}`,
        description: 'Feria de prueba',
        status: 'OPEN',
        startsAt: new Date(Date.now() + 10 * DIA),
        endsAt: new Date(Date.now() + 11 * DIA),
      },
    });
    // Empieza en 12 h: el cierre por defecto (24 h antes) ya pasó.
    feriaVencida = await prisma.fair.create({
      data: {
        organizationId: orgA.id,
        name: `Feria vencida ${runId}`,
        status: 'OPEN',
        startsAt: new Date(Date.now() + 12 * HORA),
      },
    });
    feriaDocente = await prisma.fair.create({
      data: {
        organizationId: orgA.id,
        name: `Feria del docente ${runId}`,
        status: 'OPEN',
        startsAt: new Date(Date.now() + 20 * DIA),
      },
    });
    feriaB = await prisma.fair.create({
      data: {
        organizationId: orgB.id,
        name: `Feria de otra org ${runId}`,
        status: 'OPEN',
        startsAt: new Date(Date.now() + 10 * DIA),
      },
    });

    categoria = await prisma.fairCategory.create({
      data: { fairId: feria.id, name: 'Innovación', description: 'Proyectos de innovación' },
    });
    await prisma.fairCategory.create({
      data: { fairId: feriaDocente.id, name: 'Robótica' },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('El enlace solo existe cuando el admin lo habilita', () => {
    it('sin habilitar, la feria no tiene enlace público', async () => {
      const res = await api('get', `/api/fairs/${feria.id}`, 'admin');
      expect(res.status).toBe(200);
      expect(res.body.data.public_registration).toEqual(
        expect.objectContaining({ enabled: false, url: null })
      );
    });

    it('un token inventado no revela nada (404)', async () => {
      const res = await request(app).get('/api/public/inscripciones/tokenqueNoExiste123456');
      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('Esta inscripción no está disponible');
    });

    it('el admin habilita el enlace y recibe la dirección para repartir', async () => {
      const res = await api('post', `/api/fairs/${feria.id}/public-registration`, 'admin').send({
        enabled: true,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.public_registration.enabled).toBe(true);
      expect(res.body.data.public_registration.url).toContain('/inscripcion/');
      enlace = res.body.data.public_registration.url.split('/').pop();

      enlaceDocente = await habilitarEnlace(feriaDocente.id);
      enlaceB = await api('post', `/api/fairs/${feriaB.id}/public-registration`, 'adminB')
        .send({ enabled: true })
        .then((r) => r.body.data.public_registration.url.split('/').pop());
    });

    it('el admin de otra organización no puede tocar el enlace (403)', async () => {
      const res = await api('post', `/api/fairs/${feria.id}/public-registration`, 'adminB').send({
        enabled: true,
      });
      expect(res.status).toBe(403);
    });

    it('no se publica el enlace de una feria con el plazo vencido (409)', async () => {
      const res = await api(
        'post',
        `/api/fairs/${feriaVencida.id}/public-registration`,
        'admin'
      ).send({ enabled: true });
      expect(res.status).toBe(409);
    });
  });

  describe('La página pública', () => {
    it('muestra la feria con el logo y los colores de la institución', async () => {
      const res = await request(app).get(`/api/public/inscripciones/${enlace}`);
      expect(res.status).toBe(200);

      const data = res.body.data;
      expect(data.name).toBe(feria.name);
      expect(data.registration_open).toBe(true);
      expect(data.academic_period.name).toContain('2026-II');
      expect(data.categories).toHaveLength(1);
      expect(data.organization).toEqual({
        name: orgA.name,
        logo_url: 'https://cdn.example.edu.pe/logo-tecsup.png',
        primary_color: '#00AEEF',
        secondary_color: '#003A5D',
      });
    });

    it('no expone proyectos ya inscritos ni datos de otras personas', async () => {
      const res = await request(app).get(`/api/public/inscripciones/${enlace}`);
      expect(Object.keys(res.body.data)).not.toContain('projects');
      expect(JSON.stringify(res.body.data)).not.toContain(users.alumno1.email);
    });
  });

  describe('Verificación del correo institucional', () => {
    it('un correo que no es de la institución recibe la misma respuesta (sin filtrar quién existe)', async () => {
      const res = await request(app)
        .post(`/api/public/inscripciones/${enlace}/codigo`)
        .send({ email: `desconocido.${runId}@gmail.com` });
      expect(res.status).toBe(200);
      expect(codigos.has(`desconocido.${runId}@gmail.com`)).toBe(false);
    });

    it('un alumno de OTRA organización no recibe código con este enlace', async () => {
      const res = await request(app)
        .post(`/api/public/inscripciones/${enlace}/codigo`)
        .send({ email: users.alumnoB.email });
      expect(res.status).toBe(200);
      expect(codigos.has(users.alumnoB.email.toLowerCase())).toBe(false);
    });

    it('un alumno de la institución recibe su código', async () => {
      const res = await request(app)
        .post(`/api/public/inscripciones/${enlace}/codigo`)
        .send({ email: users.alumno1.email.toUpperCase() });
      expect(res.status).toBe(200);
      expect(codigos.get(users.alumno1.email.toLowerCase())).toMatch(/^\d{6}$/);
    });

    it('un código equivocado no entra (400)', async () => {
      const res = await request(app)
        .post(`/api/public/inscripciones/${enlace}/sesion`)
        .send({ email: users.alumno1.email, code: '000000' });
      expect([400, 429]).toContain(res.status);
    });

    it('el código correcto entrega un permiso temporal', async () => {
      const sesion = await entrarComo(enlace, users.alumno1.email);
      expect(sesion.access_token).toEqual(expect.any(String));
      expect(sesion.participant.role).toBe('STUDENT');
      expect(sesion.project).toBeNull();
    });

    it('el mismo código no sirve dos veces (400)', async () => {
      const codigo = codigos.get(users.alumno1.email.toLowerCase());
      const res = await request(app)
        .post(`/api/public/inscripciones/${enlace}/sesion`)
        .send({ email: users.alumno1.email, code: codigo });
      expect(res.status).toBe(400);
    });
  });

  describe('El estudiante inscribe su grupo', () => {
    let sesion;

    beforeAll(async () => {
      sesion = await entrarComo(enlace, users.alumno1.email);
    });

    it('sin permiso temporal no se inscribe nada (401)', async () => {
      const res = await request(app)
        .post(`/api/public/inscripciones/${enlace}/proyecto`)
        .send({ name: 'Proyecto sin permiso' });
      expect(res.status).toBe(401);
    });

    it('un integrante de otra organización no se puede agregar (400)', async () => {
      const res = await request(app)
        .post(`/api/public/inscripciones/${enlace}/proyecto`)
        .set('X-Registration-Token', sesion.access_token)
        .send({
          name: 'Proyecto con ajeno',
          category_id: categoria.id,
          members: [users.alumnoB.email],
        });
      expect(res.status).toBe(400);
    });

    it('el alumno inscribe su proyecto, agrega compañeros y asesor, y entra a revisión', async () => {
      const res = await request(app)
        .post(`/api/public/inscripciones/${enlace}/proyecto`)
        .set('X-Registration-Token', sesion.access_token)
        .send({
          name: `Riego inteligente ${runId}`,
          description: 'Sistema de riego con sensores',
          category_id: categoria.id,
          members: [users.alumno2.email, users.docente.email],
        });

      expect(res.status).toBe(201);
      const proyecto = res.body.data;
      expect(proyecto.status).toBe('SUBMITTED');
      expect(proyecto.category.id).toBe(categoria.id);

      const roles = Object.fromEntries(proyecto.members.map((m) => [m.email, m.role]));
      expect(roles[users.alumno1.email]).toBe('EXPOSITOR');
      expect(roles[users.alumno2.email]).toBe('EXPOSITOR');
      expect(roles[users.docente.email]).toBe('ADVISOR');
    });

    it('el responsable del proyecto es el alumno que lo inscribió', async () => {
      const proyecto = await prisma.project.findFirst({
        where: { fairId: feria.id, name: `Riego inteligente ${runId}` },
        select: { createdById: true },
      });
      expect(proyecto.createdById).toBe(users.alumno1.id);
    });

    it('el mismo alumno no puede inscribir un segundo proyecto (409)', async () => {
      const res = await request(app)
        .post(`/api/public/inscripciones/${enlace}/proyecto`)
        .set('X-Registration-Token', sesion.access_token)
        .send({ name: 'Segundo proyecto', category_id: categoria.id });
      expect(res.status).toBe(409);
    });

    it('no se puede agregar a alguien que ya participa en otro proyecto, y no queda nada a medias (409)', async () => {
      const libre = await entrarComo(enlace, users.alumno3.email);

      const res = await request(app)
        .post(`/api/public/inscripciones/${enlace}/proyecto`)
        .set('X-Registration-Token', libre.access_token)
        .send({
          name: 'Proyecto con compañero ocupado',
          category_id: categoria.id,
          members: [users.alumno2.email],
        });
      expect(res.status).toBe(409);

      // Si el proyecto se hubiera creado a medias, quien lo intentó quedaría
      // inscrito en él y no podría volver a intentarlo.
      const reintento = await entrarComo(enlace, users.alumno3.email);
      expect(reintento.project).toBeNull();
    });

    it('un compañero ya inscrito tampoco puede inscribir otro proyecto (409)', async () => {
      const otra = await entrarComo(enlace, users.alumno2.email);
      expect(otra.project.name).toBe(`Riego inteligente ${runId}`);

      const res = await request(app)
        .post(`/api/public/inscripciones/${enlace}/proyecto`)
        .set('X-Registration-Token', otra.access_token)
        .send({ name: 'Proyecto paralelo', category_id: categoria.id });
      expect(res.status).toBe(409);
    });
  });

  describe('Observaciones del admin y corrección', () => {
    let proyectoId;

    beforeAll(async () => {
      const proyecto = await prisma.project.findFirst({
        where: { fairId: feria.id, name: `Riego inteligente ${runId}` },
        select: { id: true },
      });
      proyectoId = proyecto.id;
    });

    it('el admin ve la inscripción y la rechaza con observaciones', async () => {
      avisos.length = 0;
      const res = await api('post', `/api/projects/${proyectoId}/review`, 'admin').send({
        decision: 'REJECTED',
        review_notes: 'Falta detallar el presupuesto del proyecto',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REJECTED');
    });

    it('las observaciones llegan por correo con el enlace para corregir', async () => {
      expect(avisos).toHaveLength(1);
      expect(avisos[0].email).toBe(users.alumno1.email);
      expect(avisos[0].decision).toBe('REJECTED');
      expect(avisos[0].reviewNotes).toContain('presupuesto');
      expect(avisos[0].link).toContain(`/inscripcion/${enlace}`);
    });

    it('al volver a entrar, el alumno ve el motivo del rechazo', async () => {
      const sesion = await entrarComo(enlace, users.alumno1.email);
      expect(sesion.project.status).toBe('REJECTED');
      expect(sesion.project.review_notes).toContain('presupuesto');

      const res = await request(app)
        .get(`/api/public/inscripciones/${enlace}/proyecto`)
        .set('X-Registration-Token', sesion.access_token);
      expect(res.status).toBe(200);
      expect(res.body.data.project.review_notes).toContain('presupuesto');
    });

    it('corrige, cambia de integrantes y lo reenvía a revisión', async () => {
      const sesion = await entrarComo(enlace, users.alumno1.email);
      const res = await request(app)
        .put(`/api/public/inscripciones/${enlace}/proyecto`)
        .set('X-Registration-Token', sesion.access_token)
        .send({
          description: 'Sistema de riego con sensores. Presupuesto: S/ 1,200',
          members: [users.alumno3.email, users.docente.email],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SUBMITTED');
      expect(res.body.data.description).toContain('Presupuesto');

      const correos = res.body.data.members.map((m) => m.email);
      expect(correos).toContain(users.alumno1.email);
      expect(correos).toContain(users.alumno3.email);
      expect(correos).not.toContain(users.alumno2.email);
    });

    it('el compañero que salió del proyecto puede inscribir el suyo', async () => {
      const sesion = await entrarComo(enlace, users.alumno2.email);
      expect(sesion.project).toBeNull();
    });

    it('la aprobación también se avisa por correo', async () => {
      avisos.length = 0;
      const res = await api('post', `/api/projects/${proyectoId}/review`, 'admin').send({
        decision: 'APPROVED',
      });
      expect(res.status).toBe(200);
      expect(avisos[0].decision).toBe('APPROVED');
    });
  });

  describe('El docente inscribe a sus alumnos', () => {
    it('sin ningún estudiante no hay inscripción (400)', async () => {
      const sesion = await entrarComo(enlaceDocente, users.docente.email);
      expect(sesion.participant.role).toBe('TEACHER');

      const res = await request(app)
        .post(`/api/public/inscripciones/${enlaceDocente}/proyecto`)
        .set('X-Registration-Token', sesion.access_token)
        .send({ name: 'Proyecto sin alumnos' });
      expect(res.status).toBe(400);
    });

    it('el docente inscribe el proyecto y queda como asesor', async () => {
      const sesion = await entrarComo(enlaceDocente, users.docente.email);
      const categoriaDocente = await prisma.fairCategory.findFirst({
        where: { fairId: feriaDocente.id },
      });

      const res = await request(app)
        .post(`/api/public/inscripciones/${enlaceDocente}/proyecto`)
        .set('X-Registration-Token', sesion.access_token)
        .send({
          name: `Brazo robótico ${runId}`,
          category_id: categoriaDocente.id,
          members: [users.alumno1.email, users.alumno2.email],
        });

      expect(res.status).toBe(201);
      const roles = Object.fromEntries(res.body.data.members.map((m) => [m.email, m.role]));
      expect(roles[users.docente.email]).toBe('ADVISOR');
      expect(roles[users.alumno1.email]).toBe('EXPOSITOR');
      expect(roles[users.alumno2.email]).toBe('EXPOSITOR');
    });
  });

  describe('Cierre del enlace', () => {
    it('el enlace de otra organización no acepta correos ajenos', async () => {
      // Se olvida cualquier código anterior de esta persona para comprobar
      // que con ESTE enlace no se le envía ninguno.
      codigos.delete(users.alumno3.email.toLowerCase());

      const res = await request(app)
        .post(`/api/public/inscripciones/${enlaceB}/codigo`)
        .send({ email: users.alumno3.email });
      expect(res.status).toBe(200);
      expect(codigos.has(users.alumno3.email.toLowerCase())).toBe(false);
    });

    it('al apagar el enlace la página deja de responder (404)', async () => {
      const sesion = await entrarComo(enlaceDocente, users.docente.email);
      await habilitarEnlace(feriaDocente.id, false);

      const pagina = await request(app).get(`/api/public/inscripciones/${enlaceDocente}`);
      expect(pagina.status).toBe(404);

      // El permiso temporal que ya estaba entregado también deja de valer.
      const conSesion = await request(app)
        .get(`/api/public/inscripciones/${enlaceDocente}/proyecto`)
        .set('X-Registration-Token', sesion.access_token);
      expect(conSesion.status).toBe(404);
    });

    it('volver a habilitarlo con dirección nueva invalida la anterior', async () => {
      const anterior = enlaceDocente;
      const res = await api(
        'post',
        `/api/fairs/${feriaDocente.id}/public-registration`,
        'admin'
      ).send({ enabled: true, regenerate: true });
      expect(res.status).toBe(200);

      const nuevo = res.body.data.public_registration.url.split('/').pop();
      expect(nuevo).not.toBe(anterior);

      const viejo = await request(app).get(`/api/public/inscripciones/${anterior}`);
      expect(viejo.status).toBe(404);
      const actual = await request(app).get(`/api/public/inscripciones/${nuevo}`);
      expect(actual.status).toBe(200);
    });

    it('pasado el plazo de inscripción ya no se piden códigos (409)', async () => {
      // La feria pasa a cerrar la inscripción dentro de un momento.
      await prisma.fair.update({
        where: { id: feria.id },
        data: { registrationDeadline: new Date(Date.now() - HORA) },
      });

      const pagina = await request(app).get(`/api/public/inscripciones/${enlace}`);
      expect(pagina.status).toBe(200);
      expect(pagina.body.data.registration_open).toBe(false);

      const res = await request(app)
        .post(`/api/public/inscripciones/${enlace}/codigo`)
        .send({ email: users.alumno3.email });
      expect(res.status).toBe(409);
    });
  });
});
