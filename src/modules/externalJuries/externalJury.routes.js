// src/modules/externalJuries/externalJury.routes.js
// Rutas de jurados externos aceptados por dominio.
//
//   POST   /api/admin/jury/external/invite            → invitar jurado externo
//   GET    /api/admin/jury/external?fair_id=          → listar invitaciones
//   DELETE /api/admin/jury/external/:inviteId         → revocar (suspende cuenta)
//
// La declaración de imparcialidad y la evaluación del jurado externo se
// resuelven reutilizando los endpoints de jurado existentes
// (/api/fairs/:id/jury/*, /api/jury/*): el externo es un User rol JURY normal.

import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import * as controller from './externalJury.controller.js';
import * as schema from './externalJury.schema.js';

const router = Router();

router.use(authenticate, authorize([ROLES.ADMIN]));

router.post('/external/invite', validate(schema.inviteExternalJurySchema), controller.invite);

router.get('/external', validate(schema.listExternalJuriesSchema), controller.list);

router.delete('/external/:inviteId', validate(schema.inviteParamsSchema), controller.revoke);

export default router;