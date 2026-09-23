// src/modules/fairs/fair.service.js
// Lógica de negocio de ferias/eventos académicos.
//
// Autorización:
//   - ADMIN gestiona las ferias de SU organización (aislamiento por tenant).
//   - SUPERADMIN es administrador de plataforma y NO pertenece operacionalmente
//     a ninguna organización: 403 desde el router (sin bypass aunque tenga
//     organizationId).
//   - JURY, STUDENT y TEACHER NO tienen acceso administrativo (rutas protegidas
//     con authorize([ADMIN]); sin permisos nuevos).

import * as fairRepository from './fair.repository.js';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { parsePagination } from '../../shared/utils/pagination.js';
import { getRegistrationDeadline, isRegistrationClosed } from './fair.registration.js';
import { generateUrlSafeToken } from '../../shared/utils/hash.js';
import env from '../../config/env.js';
import { getAccessibleSiteIds } from '../../services/adminScope.service.js';

// Ruta de la página pública de inscripciones en el frontend.
const PUBLIC_REGISTRATION_PATH = '/inscripcion';

/** Enlace que el admin comparte con sus estudiantes. */
export const buildPublicRegistrationUrl = (publicToken) =>
  publicToken ? `${env.FRONTEND_URL}${PUBLIC_REGISTRATION_PATH}/${publicToken}` : null;

// Ciclo de vida de la feria: DRAFT (configuración) -> OPEN (abierta/activa)
// -> CLOSED (finalizada). CLOSED es terminal.
//
// Parte 3 — Estados de la feria: OPEN -> DRAFT solo se permite si NO existe
// participación (ningún voto y ninguna rúbrica finalizada). Si ya hay
// participación, se bloquea con 409 para preservar la coherencia del historial;
// los votos y rúbricas existentes NO se tocan.
const STATUS_TRANSITIONS = {
  DRAFT: ['OPEN'],
  OPEN: ['DRAFT', 'CLOSED'],
  CLOSED: [],
};

/**
 * ¿Existe participación en la feria?
 *   1. alguna fila en fair_vote_participation (algún voto emitido), O
 *   2. alguna fair_evaluations con submitted_at NOT NULL (rúbrica finalizada).
 */
const fairHasParticipation = async (fairId) => {
  const [votes, finalizedRubrics] = await Promise.all([
    prisma.fairVoteParticipation.count({ where: { fairId } }),
    prisma.fairEvaluation.count({ where: { fairId, submittedAt: { not: null } } }),
  ]);
  return votes > 0 || finalizedRubrics > 0;
};

/**
 * ¿Hay alguna categoría con proyectos participantes y sin jurados asignados?
 */
const fairHasCategoriesWithoutJurors = async (fairId) => {
  const categories = await prisma.fairCategory.findMany({
    where: { fairId },
    select: { id: true },
  });

  for (const cat of categories) {
    const projectCount = await prisma.project.count({
      where: { categoryId: cat.id, status: { in: ['SUBMITTED', 'APPROVED'] } },
    });
    if (projectCount > 0) {
      const juryCount = await prisma.fairJuryCategoryAssignment.count({
        where: {
          category: { id: cat.id, fairId },
        },
      });
      if (juryCount === 0) return true;
    }
  }
  return false;
};

/**
 * ¿Hay proyectos participantes sin categoría?
 */
const fairHasProjectsWithoutCategory = async (fairId) => {
  const count = await prisma.project.count({
    where: {
      fairId,
      status: { in: ['SUBMITTED', 'APPROVED'] },
      categoryId: null,
    },
  });
  return count > 0;
};

const assertTenantMatch = ({ fair, actor }) => {
  if (!actor.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }
  if (fair.organizationId !== actor.organizationId) {
    throw ApiError.forbidden('La feria no pertenece a tu organización');
  }
};

// Scope de sede: ORG ve toda su organización; REGION/SITE solo ferias cuyo
// siteId esté dentro de su scope. Sin scopeLevel (cuentas legadas/tests) se
// conserva el comportamiento ORG (aislamiento por tenant únicamente).
const assertFairAccess = async ({ fair, actor }) => {
  assertTenantMatch({ fair, actor });
  if (!actor.scopeLevel || actor.scopeLevel === 'ORG') return;
  const accessible = await getAccessibleSiteIds(actor);
  if (!fair.siteId || !accessible.includes(fair.siteId)) {
    throw ApiError.forbidden('No tienes acceso a la sede de esta feria');
  }
};

// Al crear/editar, REGION/SITE solo pueden asignar sedes de su scope.
const assertSiteScope = async ({ actor, siteId }) => {
  if (!actor.scopeLevel || actor.scopeLevel === 'ORG') return;
  const accessible = await getAccessibleSiteIds(actor);
  if (!siteId || !accessible.includes(siteId)) {
    throw ApiError.forbidden('No tienes acceso a la sede indicada');
  }
};

const assertValidDates = ({ startsAt, endsAt, registrationDeadline }) => {
  if (startsAt && endsAt && startsAt > endsAt) {
    throw ApiError.badRequest('La fecha de inicio no puede ser posterior a la fecha de fin');
  }
  if (registrationDeadline && startsAt && registrationDeadline > startsAt) {
    throw ApiError.badRequest(
      'El cierre de inscripción no puede ser posterior a la fecha de inicio de la feria'
    );
  }
};

/**
 * El período (si se indica) debe existir y ser de la MISMA organización, o ser
 * uno heredado (organization_id NULL, anterior al multi-tenant).
 */
const assertPeriodOfOrganization = async ({ periodId, organizationId }) => {
  if (periodId == null) return;
  const period = await prisma.academicPeriod.findUnique({
    where: { id: periodId },
    select: { id: true, organizationId: true },
  });
  if (!period) {
    throw ApiError.badRequest('El período académico no existe');
  }
  if (period.organizationId !== null && period.organizationId !== organizationId) {
    throw ApiError.badRequest('El período académico no pertenece a tu organización');
  }
};

/** La sede (si se indica) debe existir y pertenecer a la MISMA organización. */
const assertSiteOfOrganization = async ({ siteId, organizationId }) => {
  if (siteId == null) return;
  const site = await prisma.organizationSite.findUnique({
    where: { id: siteId },
    select: { id: true, organizationId: true },
  });
  if (!site) {
    throw ApiError.badRequest('La sede no existe');
  }
  if (site.organizationId !== organizationId) {
    throw ApiError.badRequest('La sede no pertenece a tu organización');
  }
};

const loadFair = async (fairId) => {
  const fair = await fairRepository.findById(fairId);
  if (!fair) {
    throw ApiError.notFound('Feria no encontrada');
  }
  return fair;
};

const mapFair = (fair) => ({
  id: fair.id,
  organization_id: fair.organizationId,
  name: fair.name,
  description: fair.description,
  status: fair.status,
  starts_at: fair.startsAt,
  ends_at: fair.endsAt,
  registration_deadline: fair.registrationDeadline,
  // Cierre efectivo: el configurado o, si no hay, 24 h antes del inicio.
  registration_closes_at: getRegistrationDeadline(fair),
  academic_period_id: fair.academicPeriodId ?? null,
  academic_period: fair.academicPeriod
    ? {
        id: fair.academicPeriod.id,
        name: fair.academicPeriod.name,
        start_date: fair.academicPeriod.startDate,
        end_date: fair.academicPeriod.endDate,
      }
    : null,
  // Enlace público de inscripciones (solo lo ve el admin de la feria).
  public_registration: {
    enabled: fair.publicRegistrationEnabled ?? false,
    // Aunque esté habilitado, deja de responder al cerrar la inscripción.
    open: Boolean(fair.publicRegistrationEnabled) && !isRegistrationClosed(fair),
    url: fair.publicRegistrationEnabled ? buildPublicRegistrationUrl(fair.publicToken) : null,
    enabled_at: fair.publicTokenCreatedAt ?? null,
  },
  site: fair.site
    ? {
        id: fair.site.id,
        name: fair.site.name,
        address: fair.site.address,
        city: fair.site.city,
      }
    : null,
  project_count: fair._count?.projects ?? 0,
  created_at: fair.createdAt,
  updated_at: fair.updatedAt,
});

export const listFairs = async ({ actor, filters = {} }) => {
  if (!actor.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }

  const where = { organizationId: actor.organizationId };
  if (filters.status) where.status = filters.status;

  // REGION/SITE solo ven ferias de sedes dentro de su scope.
  if (actor.scopeLevel === 'REGION' || actor.scopeLevel === 'SITE') {
    const accessible = await getAccessibleSiteIds(actor);
    where.siteId = { in: accessible };
  }

  const { page, limit, offset } = parsePagination(filters || {});

  const [data, total] = await Promise.all([
    fairRepository.list({ where, skip: offset, take: limit }),
    fairRepository.count(where),
  ]);

  return {
    data: data.map(mapFair),
    pagination: { page, limit, total },
  };
};

export const getFairById = async ({ fairId, actor }) => {
  const fair = await loadFair(fairId);
  await assertFairAccess({ fair, actor });
  return mapFair(fair);
};

export const createFair = async ({ data, actor }) => {
  if (!actor.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }

  assertValidDates({
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    registrationDeadline: data.registration_deadline,
  });
  await assertSiteOfOrganization({ siteId: data.site_id, organizationId: actor.organizationId });
  await assertSiteScope({ actor, siteId: data.site_id });
  await assertPeriodOfOrganization({
    periodId: data.academic_period_id,
    organizationId: actor.organizationId,
  });

  const fair = await fairRepository.create({
    organizationId: actor.organizationId,
    academicPeriodId: data.academic_period_id ?? null,
    name: data.name,
    description: data.description ?? null,
    status: 'DRAFT',
    siteId: data.site_id ?? null,
    startsAt: data.starts_at ?? null,
    endsAt: data.ends_at ?? null,
    registrationDeadline: data.registration_deadline ?? null,
  });

  return mapFair(fair);
};

export const updateFair = async ({ fairId, data, actor }) => {
  const fair = await loadFair(fairId);
  await assertFairAccess({ fair, actor });

  if (fair.status === 'CLOSED') {
    throw ApiError.conflict('La feria está finalizada y no admite modificaciones');
  }

  const nextStartsAt = data.starts_at !== undefined ? data.starts_at : fair.startsAt;
  const nextEndsAt = data.ends_at !== undefined ? data.ends_at : fair.endsAt;
  const nextRegistrationDeadline =
    data.registration_deadline !== undefined ? data.registration_deadline : fair.registrationDeadline;
  assertValidDates({
    startsAt: nextStartsAt,
    endsAt: nextEndsAt,
    registrationDeadline: nextRegistrationDeadline,
  });

  const nextSiteId = data.site_id !== undefined ? data.site_id : fair.siteId;
  await assertSiteOfOrganization({
    siteId: nextSiteId,
    organizationId: fair.organizationId,
  });
  await assertSiteScope({ actor, siteId: nextSiteId });

  if (data.academic_period_id !== undefined) {
    await assertPeriodOfOrganization({
      periodId: data.academic_period_id,
      organizationId: fair.organizationId,
    });
  }

  const updated = await fairRepository.update(fairId, {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description || null } : {}),
    ...(data.starts_at !== undefined ? { startsAt: data.starts_at } : {}),
    ...(data.ends_at !== undefined ? { endsAt: data.ends_at } : {}),
    ...(data.registration_deadline !== undefined
      ? { registrationDeadline: data.registration_deadline }
      : {}),
    ...(data.site_id !== undefined ? { siteId: data.site_id || null } : {}),
    ...(data.academic_period_id !== undefined
      ? { academicPeriodId: data.academic_period_id || null }
      : {}),
  });

  return mapFair(updated);
};

export const changeFairStatus = async ({ fairId, data, actor }) => {
  const fair = await loadFair(fairId);
  await assertFairAccess({ fair, actor });

  const allowed = STATUS_TRANSITIONS[fair.status] || [];
  if (!allowed.includes(data.status)) {
    throw ApiError.conflict(
      `No se puede cambiar el estado de la feria de ${fair.status} a ${data.status}`
    );
  }

  // OPEN -> DRAFT queda prohibido una vez que existe participación.
  if (fair.status === 'OPEN' && data.status === 'DRAFT') {
    if (await fairHasParticipation(fairId)) {
      throw ApiError.conflict(
        'La feria ya tiene participación (votos o rúbricas finalizadas); no puede volver a preparación (DRAFT)'
      );
    }
  }

  // DRAFT -> OPEN: validaciones de integridad académica.
  if (fair.status === 'DRAFT' && data.status === 'OPEN') {
    if (await fairHasCategoriesWithoutJurors(fairId)) {
      throw ApiError.conflict(
        'No se puede abrir la feria: existen categorías con proyectos participantes sin jurados asignados'
      );
    }
    if (await fairHasProjectsWithoutCategory(fairId)) {
      throw ApiError.conflict(
        'No se puede abrir la feria: existen proyectos participantes sin categoría asignada'
      );
    }
  }

  const updated = await fairRepository.update(fairId, { status: data.status });
  return mapFair(updated);
};

/**
 * POST /api/fairs/:id/public-registration — enciende o apaga el enlace público.
 *
 * El enlace NO existe hasta que el admin lo habilita: recién ahí se genera el
 * token. Al apagarlo, la página deja de responder y se borran los códigos y
 * permisos temporales pendientes; el token se conserva para poder volver a
 * abrir la misma dirección, salvo que se pida `regenerate` (que invalida los
 * enlaces ya repartidos).
 */
export const setPublicRegistration = async ({ fairId, data, actor }) => {
  const fair = await loadFair(fairId);
  // Mismo alcance que el resto de la gestión: un admin de sede solo maneja
  // el enlace de las ferias de su sede.
  await assertFairAccess({ fair, actor });

  if (fair.status === 'CLOSED') {
    throw ApiError.conflict('La feria está finalizada: su inscripción pública no puede abrirse');
  }

  const enable = data.enabled;

  if (enable && isRegistrationClosed(fair)) {
    throw ApiError.conflict(
      'El plazo de inscripción de esta feria ya venció: amplía el cierre antes de publicar el enlace'
    );
  }

  const needsToken = enable && (!fair.publicToken || data.regenerate === true);

  const updated = await fairRepository.update(fairId, {
    publicRegistrationEnabled: enable,
    ...(needsToken
      ? { publicToken: generateUrlSafeToken(24), publicTokenCreatedAt: new Date() }
      : {}),
  });

  // Apagar el enlace corta también las sesiones en curso de esa feria.
  if (!enable || needsToken) {
    await prisma.fairRegistrationCode.deleteMany({ where: { fairId } });
  }

  return mapFair(updated);
};
