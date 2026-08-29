import * as programRepository from './program.repository.js';
import ApiError from '../../../shared/errors/ApiError.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';

// Mapeo centralizado de errores del repositorio a HTTP Errors
const handleRepositoryError = (error) => {
  if (error.message === 'FOREIGN_KEY_FACULTY') {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'La facultad especificada no existe');
  }
  if (error.message === 'UNIQUE_CONSTRAINT') {
    throw new ApiError(HTTP_STATUS.CONFLICT, 'Ya existe un programa con este código o nombre en esta facultad');
  }
  if (error.message === 'HAS_DEPENDENCIES') {
    throw new ApiError(HTTP_STATUS.CONFLICT, 'No se puede eliminar: El programa tiene registros asociados');
  }
  throw error;
};

export const listPrograms = async (query = {}) => {
  const skip = Math.max(0, Number(query.skip) || 0);
  const take = Math.min(100, Math.max(1, Number(query.take) || 50));
  const facultyId = query.faculty_id;

  const [data, total] = await Promise.all([
    programRepository.list({ facultyId, skip, take }),
    programRepository.count(facultyId),
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

export const getProgramById = async (id) => {
  const program = await programRepository.findById(id);
  if (!program) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Programa no encontrado');
  return program;
};

export const createProgram = async (data) => {
  try {
    return await programRepository.create(data);
  } catch (error) {
    handleRepositoryError(error);
  }
};

export const updateProgram = async (id, data) => {
  try {
    const updated = await programRepository.update(id, data);
    if (!updated) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Programa no encontrado');
    return updated;
  } catch (error) {
    handleRepositoryError(error);
  }
};

export const deleteProgram = async (id) => {
  try {
    const deleted = await programRepository.deleteById(id);
    if (!deleted) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Programa no encontrado');
    return true;
  } catch (error) {
    handleRepositoryError(error);
  }
};