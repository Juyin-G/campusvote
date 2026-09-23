// src/modules/academic/period/period.service.js
// Períodos académicos (2026-I, 2026-II...) de CADA institución.
//
// Multi-tenant: cada ADMIN gestiona los períodos de su organización. Los
// períodos "heredados" (organization_id NULL) son los que existían antes de
// esta separación: se siguen viendo y editando desde cualquier institución
// para no romper configuraciones ya hechas, pero los nuevos nacen con dueño.

import * as periodRepository from './period.repository.js';
import ApiError from '../../../shared/errors/ApiError.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';

/** Organización del actor (null para períodos heredados / sin institución). */
const getOrganizationId = (actor) => actor?.organizationId ?? null;

/** El período es visible para el actor: es de su institución o es heredado. */
const assertVisible = (period, organizationId) => {
  if (period.organizationId !== null && period.organizationId !== organizationId) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Período no encontrado');
  }
};

export const listPeriods = async (query = {}, actor = null) => {
  const skip = Math.max(0, Number(query.skip) || 0);
  const take = Math.min(100, Math.max(1, Number(query.take) || 50));
  const organizationId = getOrganizationId(actor);

  const [data, total] = await Promise.all([
    periodRepository.list({ skip, take, organizationId }),
    periodRepository.count(organizationId),
  ]);

  return {
    data,
    meta: {
      total,
      skip,
      take,
      hasMore: skip + data.length < total,
    },
  };
};

export const getPeriodById = async (id, actor = null) => {
  const period = await periodRepository.findById(id);
  if (!period) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Período no encontrado');
  if (actor) assertVisible(period, getOrganizationId(actor));
  return period;
};

export const createPeriod = async (payload, actor = null) => {
  const isActive = payload.is_active ?? false;
  const organizationId = getOrganizationId(actor);

  if (isActive) {
    const overlapping = await periodRepository.checkOverlap(
      new Date(payload.start_date),
      new Date(payload.end_date),
      null,
      organizationId
    );
    if (overlapping) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        `El período choca con un período activo existente: ${overlapping.name}`
      );
    }
  }

  return periodRepository.create({
    organizationId,
    name: payload.name,
    startDate: new Date(payload.start_date),
    endDate: new Date(payload.end_date),
    isActive,
  });
};

export const updatePeriod = async (id, payload, actor = null) => {
  const currentPeriod = await getPeriodById(id, actor);

  const startDate = payload.start_date ? new Date(payload.start_date) : currentPeriod.startDate;
  const endDate = payload.end_date ? new Date(payload.end_date) : currentPeriod.endDate;

  if (startDate >= endDate) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      'La fecha de inicio debe ser estrictamente anterior a la fecha de fin'
    );
  }

  // Evalúa si el período QUEDARÁ activo tras la actualización
  const willBeActive = payload.is_active !== undefined ? payload.is_active : currentPeriod.isActive;

  if (willBeActive) {
    const overlapping = await periodRepository.checkOverlap(
      startDate,
      endDate,
      id,
      currentPeriod.organizationId
    );
    if (overlapping) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        `Las nuevas fechas chocan con un período activo existente: ${overlapping.name}`
      );
    }
  }

  const data = {};
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.start_date !== undefined) data.startDate = startDate;
  if (payload.end_date !== undefined) data.endDate = endDate;
  if (payload.is_active !== undefined) data.isActive = payload.is_active;

  return periodRepository.update(id, data);
};

export const setActivePeriod = async (id, actor = null) => {
  const period = await getPeriodById(id, actor);
  return periodRepository.setActive(id, period.organizationId);
};

export const deletePeriod = async (id, actor = null) => {
  await getPeriodById(id, actor);

  const hasRegistries = await periodRepository.hasAssociatedRegistries(id);
  if (hasRegistries) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      'No se puede eliminar el período académico porque tiene registros asociados'
    );
  }

  const hasFairs = await periodRepository.hasAssociatedFairs(id);
  if (hasFairs) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      'No se puede eliminar el período académico porque tiene ferias asociadas'
    );
  }

  return periodRepository.deleteById(id);
};
