// src/modules/publicRegistration/publicRegistration.service.js
// PÁGINA PÚBLICA DE INSCRIPCIÓN DE PROYECTOS.
//
// El admin habilita el enlace de una feria y lo reparte. Quien entra no tiene
// sesión: escribe su correo institucional, recibe un código de 6 dígitos y con
// él obtiene un permiso temporal para inscribir o corregir SU proyecto.
//
// Quién puede entrar:
//   - El ESTUDIANTE, que se inscribe a sí mismo y agrega a sus compañeros
//     (queda como responsable del proyecto).
//   - El DOCENTE asesor, cuando el estudiante no puede hacerlo: inscribe a sus
//     alumnos y queda como asesor.
//
// Las demás reglas las decide project.service (misma organización, categorías
// de la feria, un estudiante en un solo proyecto por feria, cierre de
// inscripción): este módulo NO duplica reglas, solo resuelve la identidad y
// arma el actor con el que se llaman esas operaciones.

import * as fairRepository from '../fairs/fair.repository.js';
import * as projectService from '../projects/project.service.js';
import * as repository from './publicRegistration.repository.js';
import { getRegistrationDeadline, isRegistrationClosed } from '../fairs/fair.registration.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';
import {
  generateNumericCode,
  generateSha256Hash,
  generateUrlSafeToken,
} from '../../shared/utils/hash.js';
import emailService from '../../shared/services/email.service.js';
import logger from '../../config/logger.js';
import env from '../../config/env.js';

const CODE_TTL_MINUTES = 15;
const SESSION_TTL_MINUTES = 30;
const MAX_CODE_ATTEMPTS = 5;

const minutesFromNow = (minutes) => new Date(Date.now() + minutes * 60 * 1000);

// Mensaje único para "el enlace no existe / está apagado / la feria terminó":
// la página pública no debe dejar deducir qué ferias existen.
const LINK_UNAVAILABLE = 'Esta inscripción no está disponible';

/** Feria detrás del enlace público, o 404 sin dar detalles. */
const loadPublicFair = async (publicToken) => {
  const fair = await fairRepository.findByPublicToken(publicToken);
  if (!fair || !fair.publicRegistrationEnabled || fair.status === 'CLOSED') {
    throw ApiError.notFound(LINK_UNAVAILABLE);
  }
  return fair;
};

/** Datos que pinta la página: feria, categorías y la marca de la institución. */
const mapPublicFair = (fair) => ({
  name: fair.name,
  description: fair.description,
  starts_at: fair.startsAt,
  ends_at: fair.endsAt,
  registration_closes_at: getRegistrationDeadline(fair),
  registration_open: !isRegistrationClosed(fair),
  academic_period: fair.academicPeriod ? { name: fair.academicPeriod.name } : null,
  site: fair.site ? { name: fair.site.name, address: fair.site.address, city: fair.site.city } : null,
  categories: (fair.categories ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
  })),
  // La página se pinta con la identidad de la institución, no con la de CampusVote.
  organization: {
    name: fair.organization?.name ?? null,
    logo_url: fair.organization?.logo ?? null,
    primary_color: fair.organization?.primaryColor ?? null,
    secondary_color: fair.organization?.secondaryColor ?? null,
  },
});

const mapParticipant = (user) => ({
  first_name: user.firstName,
  last_name: user.lastName,
  role: user.role,
  email: user.email,
});

const mapMyProject = (project) =>
  project
    ? {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        // Observaciones del admin: es lo que el estudiante debe corregir.
        review_notes: project.reviewNotes,
        reviewed_at: project.reviewedAt,
        submitted_at: project.submittedAt,
        category: project.category ? { id: project.category.id, name: project.category.name } : null,
        members: project.members.map((m) => ({
          role: m.role,
          email: m.user.email,
          first_name: m.user.firstName,
          last_name: m.user.lastName,
        })),
      }
    : null;

/** La inscripción sigue abierta (si no, la página solo informa). */
const assertRegistrationOpen = (fair) => {
  if (isRegistrationClosed(fair)) {
    const deadline = getRegistrationDeadline(fair);
    throw ApiError.conflict(
      `El plazo de inscripción de esta feria cerró el ${deadline.toLocaleDateString('es-PE')}`
    );
  }
};

// ── 1. La página ────────────────────────────────────────────────────

export const getPublicFair = async ({ publicToken }) => {
  const fair = await loadPublicFair(publicToken);
  return mapPublicFair(fair);
};

// ── 2. Código al correo institucional ───────────────────────────────

/**
 * Envía un código de 6 dígitos al correo. La respuesta es SIEMPRE la misma,
 * exista o no la persona: si dijera "ese correo no está registrado", el enlace
 * público serviría para averiguar quién estudia en la institución.
 */
export const requestAccessCode = async ({ publicToken, email }) => {
  const fair = await loadPublicFair(publicToken);
  assertRegistrationOpen(fair);

  const participant = await repository.findParticipantByEmail({
    email,
    organizationId: fair.organizationId,
  });

  if (participant) {
    const code = generateNumericCode(6);

    // Solo vale el último código pedido.
    await repository.deleteCodesFor({ fairId: fair.id, userId: participant.id });
    await repository.createCode({
      fairId: fair.id,
      userId: participant.id,
      codeHash: generateSha256Hash(code),
      expiresAt: minutesFromNow(CODE_TTL_MINUTES),
    });

    try {
      await emailService.sendFairRegistrationCode({
        email: participant.email,
        code,
        fairName: fair.name,
        organizationName: fair.organization?.name,
        minutes: CODE_TTL_MINUTES,
        firstName: participant.firstName,
      });
    } catch (error) {
      // Sin correo configurado (desarrollo) el código queda en el log para
      // poder probar el flujo; en producción solo se registra el fallo.
      logger.error('No se pudo enviar el código de inscripción', {
        fairId: fair.id,
        error: error.message,
        ...(env.NODE_ENV === 'production' ? {} : { code }),
      });
    }
  }

  return {
    expires_in_minutes: CODE_TTL_MINUTES,
  };
};

// ── 3. Canje del código por un permiso temporal ─────────────────────

export const redeemAccessCode = async ({ publicToken, email, code }) => {
  const fair = await loadPublicFair(publicToken);
  assertRegistrationOpen(fair);

  const invalido = () => ApiError.badRequest('El código no es correcto o ya venció');

  const participant = await repository.findParticipantByEmail({
    email,
    organizationId: fair.organizationId,
  });
  if (!participant) throw invalido();

  const stored = await repository.findLastCode({ fairId: fair.id, userId: participant.id });
  if (!stored || stored.expiresAt <= new Date()) throw invalido();

  if (stored.attempts >= MAX_CODE_ATTEMPTS) {
    await repository.deleteCodeById(stored.id);
    throw ApiError.tooManyRequests(
      'Demasiados intentos con este código. Pide uno nuevo.',
      null,
      'REGISTRATION_CODE_ATTEMPTS'
    );
  }

  if (generateSha256Hash(String(code)) !== stored.codeHash) {
    await repository.registerAttempt(stored.id);
    throw invalido();
  }

  const sessionToken = generateUrlSafeToken(32);
  const session = await repository.consumeCode({
    id: stored.id,
    sessionHash: generateSha256Hash(sessionToken),
    sessionExpiresAt: minutesFromNow(SESSION_TTL_MINUTES),
  });

  const project = await repository.findProjectOfParticipant({
    fairId: fair.id,
    userId: participant.id,
  });

  return {
    access_token: sessionToken,
    expires_at: session.sessionExpiresAt,
    participant: mapParticipant(participant),
    project: mapMyProject(project),
  };
};

// ── 4. Sesión de la página ──────────────────────────────────────────

/** Resuelve el permiso temporal a la persona que lo pidió. */
const loadSession = async ({ publicToken, sessionToken }) => {
  const fair = await loadPublicFair(publicToken);

  if (!sessionToken) {
    throw ApiError.unauthorized('Valida tu correo antes de continuar');
  }

  const session = await repository.findSession({
    fairId: fair.id,
    sessionHash: generateSha256Hash(String(sessionToken)),
  });
  if (!session) {
    throw ApiError.unauthorized('Tu acceso venció. Pide un código nuevo.');
  }

  const participant = await repository.findParticipantById(session.userId);
  if (!participant || participant.organizationId !== fair.organizationId) {
    throw ApiError.unauthorized('Tu acceso venció. Pide un código nuevo.');
  }

  // El actor con el que se ejecutan las reglas normales de proyectos.
  const actor = {
    id: participant.id,
    role: participant.role,
    organizationId: participant.organizationId,
  };

  return { fair, participant, actor };
};

// ── 5. Inscripción ──────────────────────────────────────────────────

/**
 * Resuelve los correos de los integrantes ANTES de crear nada: si uno está mal
 * escrito o ya participa en otro proyecto, no queremos dejar a medias un
 * proyecto creado.
 */
const resolveMembers = async ({ fair, emails, actor, excludeProjectId = null }) => {
  const resultado = [];

  for (const email of emails) {
    const user = await repository.findParticipantByEmail({
      email,
      organizationId: fair.organizationId,
    });
    if (!user) {
      throw ApiError.badRequest(
        `${email} no figura como estudiante o docente de la institución`
      );
    }
    if (user.id === actor.id) continue; // ya participa como responsable
    if (resultado.some((m) => m.id === user.id)) continue; // repetido en el formulario

    // Un estudiante participa en un solo proyecto por feria. Se comprueba
    // ANTES de crear nada: si no, quedaría un proyecto a medias imposible de
    // retomar (la persona ya figuraría inscrita en él).
    if (user.role === ROLES.STUDENT) {
      const otro = await repository.findParticipationInFair({ fairId: fair.id, userId: user.id });
      if (otro && otro.project.id !== excludeProjectId) {
        throw ApiError.conflict(
          `${email} ya participa en el proyecto "${otro.project.name}" de esta feria`
        );
      }
    }

    resultado.push(user);
  }

  return resultado;
};

const memberRoleFor = (user) => (user.role === ROLES.TEACHER ? 'ADVISOR' : 'EXPOSITOR');

export const createMyProject = async ({ publicToken, sessionToken, data }) => {
  const { fair, actor } = await loadSession({ publicToken, sessionToken });
  assertRegistrationOpen(fair);

  const yaTiene = await repository.findProjectOfParticipant({ fairId: fair.id, userId: actor.id });
  if (yaTiene) {
    throw ApiError.conflict('Ya participas en un proyecto de esta feria');
  }

  const integrantes = await resolveMembers({ fair, emails: data.members ?? [], actor });

  // Un docente inscribe EN NOMBRE de sus alumnos: sin alumnos no hay proyecto.
  if (actor.role === ROLES.TEACHER && !integrantes.some((u) => u.role === ROLES.STUDENT)) {
    throw ApiError.badRequest('Agrega al menos un estudiante expositor');
  }

  const project = await projectService.createProject({
    actor,
    data: {
      fair_id: fair.id,
      name: data.name,
      description: data.description ?? null,
      category_id: data.category_id ?? null,
      project_url: data.project_url ?? null,
    },
  });

  try {
    for (const user of integrantes) {
      await projectService.addMember({
        projectId: project.id,
        actor,
        data: { email: user.email, role: memberRoleFor(user) },
      });
    }

    // La inscripción entra directo a revisión del admin.
    await projectService.submitProject({ projectId: project.id, actor });
  } catch (error) {
    // Si algo falla a mitad del formulario se borra el proyecto recién creado:
    // dejarlo a medias bloquearía a la persona (ya figuraría inscrita en él).
    await repository.deleteProject(project.id);
    throw error;
  }

  const guardado = await repository.findProjectOfParticipant({ fairId: fair.id, userId: actor.id });
  return mapMyProject(guardado);
};

// ── 6. Mi proyecto y sus correcciones ───────────────────────────────

export const getMyProject = async ({ publicToken, sessionToken }) => {
  const { fair, participant, actor } = await loadSession({ publicToken, sessionToken });
  const project = await repository.findProjectOfParticipant({ fairId: fair.id, userId: actor.id });

  return {
    participant: mapParticipant(participant),
    project: mapMyProject(project),
  };
};

/**
 * Corrige el proyecto y lo vuelve a enviar. Solo lo hace quien lo inscribió, y
 * solo mientras esté en borrador o con observaciones (project.service ya lo
 * exige); aquí se resuelve además la lista de integrantes: los que ya no están
 * se quitan y los nuevos se agregan.
 */
export const updateMyProject = async ({ publicToken, sessionToken, data }) => {
  const { fair, actor } = await loadSession({ publicToken, sessionToken });
  assertRegistrationOpen(fair);

  const actual = await repository.findProjectOfParticipant({ fairId: fair.id, userId: actor.id });
  if (!actual) {
    throw ApiError.notFound('Todavía no has inscrito ningún proyecto en esta feria');
  }
  if (actual.createdById !== actor.id) {
    throw ApiError.forbidden('Solo quien inscribió el proyecto puede corregirlo');
  }

  await projectService.updateProject({
    projectId: actual.id,
    actor,
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.category_id !== undefined ? { category_id: data.category_id } : {}),
      ...(data.project_url !== undefined ? { project_url: data.project_url } : {}),
    },
  });

  if (data.members !== undefined) {
    const deseados = await resolveMembers({
      fair,
      emails: data.members,
      actor,
      excludeProjectId: actual.id,
    });
    const deseadosIds = new Set(deseados.map((u) => u.id));

    for (const member of actual.members) {
      if (member.user.id !== actor.id && !deseadosIds.has(member.user.id)) {
        await projectService.removeMember({
          projectId: actual.id,
          userId: member.user.id,
          actor,
        });
      }
    }

    const actualesIds = new Set(actual.members.map((m) => m.user.id));
    for (const user of deseados) {
      if (!actualesIds.has(user.id)) {
        await projectService.addMember({
          projectId: actual.id,
          actor,
          data: { email: user.email, role: memberRoleFor(user) },
        });
      }
    }
  }

  await projectService.submitProject({ projectId: actual.id, actor });

  const guardado = await repository.findProjectOfParticipant({ fairId: fair.id, userId: actor.id });
  return mapMyProject(guardado);
};

export default {
  getPublicFair,
  requestAccessCode,
  redeemAccessCode,
  createMyProject,
  getMyProject,
  updateMyProject,
};
