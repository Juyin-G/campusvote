import * as facultyRepository from './faculty.repository.js';
import ApiError from '../../../shared/errors/ApiError.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';

export const listFaculties = async (query = {}) => {
  const skip = Math.max(0, Number(query.skip) || 0);
  const take = Math.min(100, Math.max(1, Number(query.take) || 50));
  
  return facultyRepository.list({ skip, take });
};

export const getFacultyById = async (id) => {
  const faculty = await facultyRepository.findById(id);
  if (!faculty) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Facultad no encontrada');
  }
  return faculty;
};

export const createFaculty = async (data) => {
  return facultyRepository.create(data);
};

export const updateFaculty = async (id, data) => {
  const updatedFaculty = await facultyRepository.update(id, data);
  if (!updatedFaculty) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Facultad no encontrada');
  }
  return updatedFaculty;
};

export const deleteFaculty = async (id) => {
  const deleted = await facultyRepository.deleteById(id);
  if (!deleted) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Facultad no encontrada');
  }
  return true;
};