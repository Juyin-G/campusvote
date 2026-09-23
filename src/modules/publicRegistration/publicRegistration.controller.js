// src/modules/publicRegistration/publicRegistration.controller.js

import * as service from './publicRegistration.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';

// El permiso temporal viaja en su propia cabecera: no es una sesión de la
// plataforma y no debe confundirse con Authorization.
const getSessionToken = (req) => req.get('X-Registration-Token') || null;

// GET /api/public/inscripciones/:token
export const getPublicFair = asyncHandler(async (req, res) => {
  const fair = await service.getPublicFair({ publicToken: req.params.token });
  return sendSuccess(res, fair, 'Feria obtenida correctamente', {}, HTTP_STATUS.OK);
});

// POST /api/public/inscripciones/:token/codigo
export const requestAccessCode = asyncHandler(async (req, res) => {
  const result = await service.requestAccessCode({
    publicToken: req.params.token,
    email: req.body.email,
  });
  return sendSuccess(
    res,
    result,
    'Si el correo pertenece a la institución, te enviamos un código',
    {},
    HTTP_STATUS.OK
  );
});

// POST /api/public/inscripciones/:token/sesion
export const redeemAccessCode = asyncHandler(async (req, res) => {
  const result = await service.redeemAccessCode({
    publicToken: req.params.token,
    email: req.body.email,
    code: req.body.code,
  });
  return sendSuccess(res, result, 'Correo verificado', {}, HTTP_STATUS.OK);
});

// GET /api/public/inscripciones/:token/proyecto
export const getMyProject = asyncHandler(async (req, res) => {
  const result = await service.getMyProject({
    publicToken: req.params.token,
    sessionToken: getSessionToken(req),
  });
  return sendSuccess(res, result, 'Inscripción obtenida correctamente', {}, HTTP_STATUS.OK);
});

// POST /api/public/inscripciones/:token/proyecto
export const createMyProject = asyncHandler(async (req, res) => {
  const project = await service.createMyProject({
    publicToken: req.params.token,
    sessionToken: getSessionToken(req),
    data: req.body,
  });
  return sendCreated(res, project, 'Proyecto inscrito y enviado a revisión');
});

// PUT /api/public/inscripciones/:token/proyecto
export const updateMyProject = asyncHandler(async (req, res) => {
  const project = await service.updateMyProject({
    publicToken: req.params.token,
    sessionToken: getSessionToken(req),
    data: req.body,
  });
  return sendSuccess(res, project, 'Proyecto corregido y reenviado a revisión', {}, HTTP_STATUS.OK);
});
