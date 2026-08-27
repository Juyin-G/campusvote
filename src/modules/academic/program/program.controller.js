import * as programService from './program.service.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';

export const getPrograms = asyncHandler(async (req, res) => {
  const { data, meta } = await programService.listPrograms(req.query);
  return sendSuccess(res, data, 'Programas obtenidos correctamente', meta, HTTP_STATUS.OK);
});

export const getProgramById = asyncHandler(async (req, res) => {
  const program = await programService.getProgramById(req.params.id);
  return sendSuccess(res, program, 'Programa obtenido correctamente', undefined, HTTP_STATUS.OK);
});

export const createProgram = asyncHandler(async (req, res) => {
  const program = await programService.createProgram(req.body);
  return sendSuccess(res, program, 'Programa creado exitosamente', undefined, HTTP_STATUS.CREATED);
});

export const updateProgram = asyncHandler(async (req, res) => {
  const program = await programService.updateProgram(req.params.id, req.body);
  return sendSuccess(res, program, 'Programa actualizado exitosamente', undefined, HTTP_STATUS.OK);
});

export const deleteProgram = asyncHandler(async (req, res) => {
  await programService.deleteProgram(req.params.id);
  return sendSuccess(res, null, 'Programa eliminado exitosamente', undefined, HTTP_STATUS.OK);
});