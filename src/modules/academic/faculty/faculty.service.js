import * as facultyRepository from './faculty.repository.js';
import ApiError from '../../../shared/errors/ApiError.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';

export const listFaculties = async (query = {}) => {
  const skip = Math.max(0, Number(query.skip) || 0);
  const take = Math.min(100, Math.max(1, Number(query.take) || 50));

  const [data, total] = await Promise.all([
    facultyRepository.list({ skip, take }),
    facultyRepository.count(),
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

export const getFacultyById = async (id) => {
  const faculty = await facultyRepository.findById(id);
  if (!faculty) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Facultad no encontrada');
  }
  return faculty;
};

export const createFaculty = async (data) => {
  const existing = await facultyRepository.findByNameOrCode(data.name, data.code);
  if (existing) {
    if (existing.name === data.name) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'Ya existe una facultad con este nombre');
    }
    if (existing.code === data.code) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'Ya existe una facultad con este código');
    }
  }

  return facultyRepository.create(data);
};

export const updateFaculty = async (id, data) => {
  await getFacultyById(id);

  if (data.name || data.code) {
    const existing = await facultyRepository.findByNameOrCode(data.name, data.code);
    if (existing && existing.id !== id) {
      if (existing.name === data.name) {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Ya existe otra facultad con este nombre');
      }
      if (existing.code === data.code) {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Ya existe otra facultad con este código');
      }
    }
  }

  return facultyRepository.update(id, data);
};

export const deleteFaculty = async (id) => {
  await getFacultyById(id);

  const hasPrograms = await facultyRepository.hasAssociatedPrograms(id);
  if (hasPrograms) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      'No se puede eliminar la facultad porque tiene programas académicos asociados'
    );
  }

  return facultyRepository.deleteById(id);
};