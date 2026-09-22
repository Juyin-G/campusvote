// src/modules/fairStands/fairStand.service.js
// Lógica de negocio de STANDS/cabinas de ferias (dominio exclusivo de FERIAS).
//
// Estructura:
//   Fair ── FairStand (fair_id + code) ── Project (projects.stand_id)
//
// Reglas:
//   - code (identificador corto, p. ej. "A-01") es único dentro de la feria
//     (UNIQUE fair_id + code).
//   - Gestión (crear/actualizar/eliminar) SOLO en DRAFT; lectura compartida
//     (ADMIN con organización dueña o JURY formalmente asignado) en cualquier
//     estado.
//   - SUPERADMIN NO tiene acceso operativo: 403 desde el router (sin bypass
//     aunque tenga organizationId).
//   - "1 stand = 1 proyecto": projects.stand_id es UNIQUE; el service traduce
//     la violación (P2002) a 409.
//   - No se elimina un stand que ya tiene un proyecto asignado → 409.

import * as standRepository from './fairStand.repository.js';
import * as fairRepository from '../fairs/fair.repository.js';
import * as juryAssignmentRepository from '../juryAssignments/juryAssignment.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';

// ✅ NUEVO: Importar el guard compartido en lugar de definirlo localmente
import { assertTenantMatch } from '../../shared/guards/tenant.guard.js';

const STAND_CONFIGURABLE_STATUSES = ['DRAFT'];

const loadFair = async (fairId) => {
  const fair = await fairRepository.findById(fairId);
  if (!fair) {
    throw ApiError.notFound('Feria no encontrada');
  }
  return fair;
};

// ✅ ELIMINADO: La función local assertTenantMatch({ fair, actor }) fue removida.
// Ahora usamos la versión compartida que también bloquea a SUPERADMIN explícitamente.

const assertJuryAssignedToFair = async ({ fairId, juryId }) => {
  const assignment = await juryAssignmentRepository.findByFairUser(fairId, juryId);
  if (!assignment) {
    throw ApiError.forbidden('No tienes asignación como jurado en esta feria');
  }
  return assignment;
};

const assertStandConfigurable = (fair) => {
  if (!STAND_CONFIGURABLE_STATUSES.includes(fair.status)) {
    throw ApiError.conflict('Los stands de la feria solo se configuran en estado DRAFT');
  }
};

const mapStand = (stand) => ({
  id: stand.id,
  fair_id: stand.fairId,
  code: stand.code,
  description: stand.description,
  created_at: stand.createdAt,
  updated_at: stand.updatedAt,
});

// ── Lectura compartida (ADMIN/JURY asignado) ───────────────────────

export const listStands = async ({ fairId, actor }) => {
  const fair = await loadFair(fairId);

  if (actor.role === ROLES.JURY) {
    await assertJuryAssignedToFair({ fairId, juryId: actor.id });
  } else {
    // ✅ ACTUALIZADO: Firma del guard compartido (actor, recurso, nombre)
    assertTenantMatch(actor, fair, 'Feria');
  }

  const stands = await standRepository.findByFair(fairId);

  return {
    fair_id: fairId,
    fair_name: fair.name,
    count: stands.length,
    stands: stands.map(mapStand),
  };
};

// ── Gestión (ADMIN; SOLO DRAFT) ───────────────────────────────────

export const createStand = async ({ fairId, data, actor }) => {
  const fair = await loadFair(fairId);
  // ✅ ACTUALIZADO
  assertTenantMatch(actor, fair, 'Feria');
  assertStandConfigurable(fair);

  try {
    const stand = await standRepository.create({
      fairId,
      code: data.code,
      description: data.description ?? null,
    });
    return mapStand(stand);
  } catch (err) {
    if (err.message === 'FAIR_STAND_DUPLICATE' || err.code === 'P2002') {
      throw ApiError.conflict('Ya existe un stand con ese código en esta feria');
    }
    throw err;
  }
};

export const updateStand = async ({ fairId, standId, data, actor }) => {
  const fair = await loadFair(fairId);
  // ✅ ACTUALIZADO
  assertTenantMatch(actor, fair, 'Feria');
  assertStandConfigurable(fair);

  const current = await standRepository.findById(standId, fairId);
  if (!current) {
    throw ApiError.notFound('Stand no encontrado en esta feria');
  }

  try {
    const updated = await standRepository.update(standId, {
      ...(data.code !== undefined ? { code: data.code } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
    });
    return mapStand(updated);
  } catch (err) {
    if (err.message === 'FAIR_STAND_DUPLICATE' || err.code === 'P2002') {
      throw ApiError.conflict('Ya existe un stand con ese código en esta feria');
    }
    throw err;
  }
};

export const deleteStand = async ({ fairId, standId, actor }) => {
  const fair = await loadFair(fairId);
  // ✅ ACTUALIZADO
  assertTenantMatch(actor, fair, 'Feria');
  assertStandConfigurable(fair);

  const current = await standRepository.findById(standId, fairId);
  if (!current) {
    throw ApiError.notFound('Stand no encontrado en esta feria');
  }

  const used = await standRepository.countProjects(standId);
  if (used > 0) {
    throw ApiError.conflict('No se puede eliminar el stand porque tiene un proyecto asignado');
  }

  await standRepository.remove(standId);

  return { deleted: true, fair_id: fairId, stand_id: standId };
};

export default {
  listStands,
  createStand,
  updateStand,
  deleteStand,
};