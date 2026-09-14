// src/modules/fairs/fair.service.js
// Lógica de negocio de ferias/eventos académicos.
//
// Autorización:
//   - ADMIN gestiona las ferias de SU organización (aislamiento por tenant).
//   - ELECTORAL_COMMISSION, JURY, STUDENT y TEACHER NO tienen acceso (rutas
//     protegidas con authorize([ADMIN, SUPERADMIN]); sin permisos nuevos).
//   - SUPERADMIN conserva, como en el resto del sistema (patrón
//     assertTenantAccess de rating/objection), el bypass de tenant para lectura
//     global: NO se le agregan capacidades nuevas de gestión.

import * as fairRepository from './fair.repository.js';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';
import { parsePagination } from '../../shared/utils/pagination.js';
import { getRegistrationDeadline } from './fair.registration.js';

const isSuperAdmin = (actor) =>
  actor.role === ROLES.SUPERADMIN || actor.isSuperAdmin || actor.isSuperuser;

// Ciclo de vida de la feria: DRAFT (configuración) -> OPEN (abierta/activa)
// -> CLOSED (finalizada). CLOSED es terminal; OPEN puede volver a DRAFT.
const STATUS_TRANSITIONS = {
  DRAFT: ['OPEN'],
  OPEN: ['DRAFT', 'CLOSED'],
  CLOSED: [],
};

const assertTenantMatch = ({ fair, actor }) => {
  if (isSuperAdmin(actor)) return;
  if (!actor.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }
  if (fair.organizationId !== actor.organizationId) {
    throw ApiError.forbidden('La feria no pertenece a tu organización');
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
  const where = isSuperAdmin(actor) ? {} : { organizationId: actor.organizationId };

  if (!isSuperAdmin(actor) && !actor.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }
  if (filters.status) where.status = filters.status;

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
  assertTenantMatch({ fair, actor });
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

  const fair = await fairRepository.create({
    organizationId: actor.organizationId,
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
  assertTenantMatch({ fair, actor });

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

  await assertSiteOfOrganization({
    siteId: data.site_id !== undefined ? data.site_id : fair.siteId,
    organizationId: fair.organizationId,
  });

  const updated = await fairRepository.update(fairId, {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description || null } : {}),
    ...(data.starts_at !== undefined ? { startsAt: data.starts_at } : {}),
    ...(data.ends_at !== undefined ? { endsAt: data.ends_at } : {}),
    ...(data.registration_deadline !== undefined
      ? { registrationDeadline: data.registration_deadline }
      : {}),
    ...(data.site_id !== undefined ? { siteId: data.site_id || null } : {}),
  });

  return mapFair(updated);
};

export const changeFairStatus = async ({ fairId, data, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });

  const allowed = STATUS_TRANSITIONS[fair.status] || [];
  if (!allowed.includes(data.status)) {
    throw ApiError.conflict(
      `No se puede cambiar el estado de la feria de ${fair.status} a ${data.status}`
    );
  }

  const updated = await fairRepository.update(fairId, { status: data.status });
  return mapFair(updated);
};

export default {
  listFairs,
  getFairById,
  createFair,
  updateFair,
  changeFairStatus,
};