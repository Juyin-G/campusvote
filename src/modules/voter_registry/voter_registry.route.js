// src/modules/voter_registry/voter_registry.route.js

import { Router } from 'express';
import { VoterRegistryController } from './voter_registry.controller.js';
import { validate } from '../../middlewares/validate.middleware.js'; // Ajustar ruta según estructura
import { authenticate, authorize } from '../../middlewares/auth.middleware.js'; // Ajustar ruta según estructura
import {
  createVoterClaimSchema,
  resolveVoterClaimSchema,
  queryVoterClaimsSchema,
  checkVoterRegistrySchema,
} from './voter_registry.schema.js';

const router = Router();

// Todas las rutas requieren autenticación previa
router.use(authenticate);

/**
 * @route   POST /api/v1/voter-registry/claims
 * @desc    Registra un nuevo reclamo de padrón para el usuario autenticado
 * @access  Private (Estudiante / Usuario autenticado)
 */
router.post(
  '/claims',
  validate(createVoterClaimSchema),
  VoterRegistryController.createClaim
);

/**
 * @route   GET /api/v1/voter-registry/status
 * @desc    Consulta el estado del usuario autenticado en el padrón electoral de un período
 * @access  Private (Cualquier usuario autenticado)
 */
router.get(
  '/status',
  validate(checkVoterRegistrySchema),
  VoterRegistryController.getMyRegistryStatus
);

/**
 * @route   GET /api/v1/voter-registry/claims
 * @desc    Obtiene la lista paginada de reclamos con filtros opcionales
 * @access  Private (ADMIN, ELECTORAL_COMMISSION)
 */
router.get(
  '/claims',
  authorize(['ADMIN', 'ELECTORAL_COMMISSION']),
  validate(queryVoterClaimsSchema),
  VoterRegistryController.getClaims
);

/**
 * @route   PATCH /api/v1/voter-registry/claims/:claimId/resolve
 * @desc    Resuelve un reclamo invocando la función PL/pgSQL
 * @access  Private (ADMIN, ELECTORAL_COMMISSION)
 */
router.patch(
  '/claims/:claimId/resolve',
  authorize(['ADMIN', 'ELECTORAL_COMMISSION']),
  validate(resolveVoterClaimSchema),
  VoterRegistryController.resolveClaim
);

export default router;