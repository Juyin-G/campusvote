import * as periodRepository from './period.repository.js';
import ApiError from '../../../shared/errors/ApiError.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';

export const listPeriods = async (query = {}) => {
  const skip = Math.max(0, Number(query.skip) || 0);
  const take = Math.min(100, Math.max(1, Number(query.take) || 50));
  
  return periodRepository.list({ skip, take });
};

export const getPeriodById = async (id) => {
  const period = await periodRepository.findById(id);
  if (!period) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Periodo no encontrado');
  return period;
};

export const createPeriod = async (data) => {
  if (data.is_active) {
    const overlapping = await periodRepository.checkOverlap(data.start_date, data.end_date);
    if (overlapping) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT, 
        `El periodo choca con un periodo activo existente: ${overlapping.name}`
      );
    }
  }

  return periodRepository.create(data);
};

export const updatePeriod = async (id, data) => {
  if (data.start_date || data.end_date) {
    const currentPeriod = await periodRepository.findById(id);
    if (!currentPeriod) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Periodo no encontrado');

    const finalStart = data.start_date ? new Date(data.start_date) : currentPeriod.start_date;
    const finalEnd = data.end_date ? new Date(data.end_date) : currentPeriod.end_date;

    if (finalStart >= finalEnd) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'La fecha de inicio debe ser anterior a la fecha de fin');
    }

    if (data.is_active !== false) { 
      const overlapping = await periodRepository.checkOverlap(finalStart, finalEnd, id);
      if (overlapping) {
        throw new ApiError(
          HTTP_STATUS.CONFLICT, 
          `Las nuevas fechas chocan con un periodo activo existente: ${overlapping.name}`
        );
      }
    }
  }

  const updatedPeriod = await periodRepository.update(id, data);
  if (!updatedPeriod) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Periodo no encontrado');
  
  return updatedPeriod;
};

export const setActivePeriod = async (id) => {
  const period = await periodRepository.findById(id);
  if (!period) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Periodo no encontrado');
  
  return periodRepository.setActive(id);
};

export const deletePeriod = async (id) => {
  const deleted = await periodRepository.deleteById(id);
  if (!deleted) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Periodo no encontrado');
  
  return true;
};