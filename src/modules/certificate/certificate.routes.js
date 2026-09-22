// src/modules/certificate/certificate.routes.js
// Rutas de CERTIFICADOS oficiales de FERIAS (dominio exclusivo de ferias).
//
//   POST /api/fairs/:id/certificates/generate   → generar certificados (ADMIN)
//   GET  /api/certificates/my                  → certificados del participante autenticado
//   GET  /api/certificates/:certificateId      → consulta individual
//   GET  /api/certificates/:certificateId/pdf  → descarga PDF (mismas reglas de auth)
//
// Autorización (validada en service):
//   - ADMIN: genera/administra certificados SOLO de ferias de SU organización.
//   - SUPERADMIN: NO tiene bypass operativo del tenant en este módulo.
//   - JURY / STUDENT / TEACHER: 403 administrativo. Pueden ver/descargar
//     únicamente certificados propios.
//   - Participante: solo sus propios certificados.
//
// Los certificados emitidos son INMUTABLES: no hay PUT/PATCH/DELETE.

import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import * as certificateController from './certificate.controller.js';
import * as certificateSchema from './certificate.schema.js';

// Sub-router para rutas bajo /api/fairs/:id/certificates
const fairCertificatesRouter = Router();
const ADMIN_ONLY = [ROLES.ADMIN];

// Solo ADMIN de la organización propietaria puede generar.
// authorize([ADMIN]) aplica el guard de rol; el service valida el tenant.
fairCertificatesRouter.post(
  '/generate',
  authenticate,
  authorize(ADMIN_ONLY),
  validate(certificateSchema.generateCertificatesSchema),
  certificateController.generateCertificates
);

// Router principal para rutas bajo /api/certificates
const certificatesRouter = Router();

certificatesRouter.use(authenticate);

certificatesRouter.get('/my', certificateController.listMyCertificates);

certificatesRouter.get(
  '/:certificateId',
  validate(certificateSchema.certificateIdParamSchema),
  certificateController.getCertificateById
);

certificatesRouter.get(
  '/:certificateId/pdf',
  validate(certificateSchema.certificateIdParamSchema),
  certificateController.downloadCertificatePdf
);

export { fairCertificatesRouter, certificatesRouter };
export default { fairCertificatesRouter, certificatesRouter };