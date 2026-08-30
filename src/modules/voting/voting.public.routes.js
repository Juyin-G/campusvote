// src/modules/voting/voting.public.routes.js
// Rutas PÚBLICAS del módulo de VOTACIÓN (no requieren autenticación).
// Se montan en la raíz bajo `/public` desde src/routes/index.js para
// respetar la ruta del spec: GET /public/verify-receipt/:receiptCode

import { Router } from 'express';

import * as votingController from './voting.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { receiptParamsSchema } from './voting.schema.js';

const router = Router();

/**
 * GET /public/verify-receipt/:receiptCode
 * @desc Verificación pública de un comprobante de voto.
 * @access Público (sin autenticación)
 */
router.get(
  '/verify-receipt/:receiptCode',
  validate(receiptParamsSchema),
  votingController.verifyReceipt
);

export default router;
