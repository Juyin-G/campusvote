import * as facultyService from './faculty.service.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';

export const getFaculties = asyncHandler(async (req, res) => {
  const { data, meta } = await facultyService.listFaculties(req.query);
  return sendSuccess(res, data, 'Facultades obtenidas', meta, HTTP_STATUS.OK);
});

export const getFacultyById = asyncHandler(async (req, res) => {
  const faculty = await facultyService.getFacultyById(req.params.id);
  return sendSuccess(res, faculty, 'Facultad obtenida', undefined, HTTP_STATUS.OK);
});

export const createFaculty = asyncHandler(async (req, res) => {
  const faculty = await facultyService.createFaculty(req.body);
  return sendSuccess(res, faculty, 'Facultad creada', undefined, HTTP_STATUS.CREATED);
});

export const updateFaculty = asyncHandler(async (req, res) => {
  const faculty = await facultyService.updateFaculty(req.params.id, req.body);
  return sendSuccess(res, faculty, 'Facultad actualizada', undefined, HTTP_STATUS.OK);
});

export const deleteFaculty = asyncHandler(async (req, res) => {
  await facultyService.deleteFaculty(req.params.id);
  return sendSuccess(res, null, 'Facultad eliminada', undefined, HTTP_STATUS.OK);
});