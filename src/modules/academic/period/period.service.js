import * as periodRepository from './period.repository.js';
import ApiError from '../../../shared/errors/ApiError.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';

export const listPeriods = async (query = {}) => {
  const skip = Math.max(0, Number(query.skip) || 0);
  const take = Math.min(100, Math.max(1, Number(query.take) || 50));

  const [data, total] = await Promise.all([
    periodRepository.list({ skip, take }),
    periodRepository.count(),
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

export const getPeriodById = async (id) => {
  const period = await periodRepository.findById(id);
  if (!period) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Período no encontrado');
  return period;
};

export const createPeriod = async (payload) => {
  const isActive = payload.is_active ?? false;

  if (isActive) {
    const overlapping = await periodRepository.checkOverlap(payload.start_date, payload.end_date);
    if (overlapping) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        `El período choca con un período activo existente: ${overlapping.name}`
      );
    }
  }

  return periodRepository.create({
    name: payload.name,
    startDate: new Date(payload.start_date),
    endDate: new Date(payload.end_date),
    isActive,
  });
};

export const updatePeriod = async (id, payload) => {
  const currentPeriod = await getPeriodById(id);

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
    const overlapping = await periodRepository.checkOverlap(startDate, endDate, id);
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

export const setActivePeriod = async (id) => {
  await getPeriodById(id);
  return periodRepository.setActive(id);
};

export const deletePeriod = async (id) => {
  await getPeriodById(id);

  const hasRegistries = await periodRepository.hasAssociatedRegistries(id);
  if (hasRegistries) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      'No se puede eliminar el período académico porque tiene registros asociados'
    );
  }

  return periodRepository.deleteById(id);
};