// src/modules/organizations/organizationSite/organizationSite.routes.js
// Rutas de sedes de organizaciones (contexto físico de ferias).
//
// ADMIN / SUPERADMIN:
//   GET    /api/organizations/sites              → sedes de mi organización (o todas si SUPERADMIN)
//   POST   /api/organizations/sites              → crear sede
//   GET    /api/organizations/sites/:siteId      → detalle de una sede
//   PUT    /api/organizations/sites/:siteId      → actualizar sede
//   DELETE /api/organizations/sites/:siteId      → eliminar sede
//
// El aislamiento por organización (tenant) lo resuelve el service:
// ADMIN solo ve/gestiona sedes de SU organización; SUPERADMIN conserva el
// bypass de tenant del sistema.

import { Router } from 'express';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { ROLES } from '../../../constants/roles.js';
import * as siteController from './organizationSite.controller.js';
import * as siteSchema from './organizationSite.schema.js';

const router = Router();

const MANAGERS = [ROLES.ADMIN, ROLES.SUPERADMIN];

router.use(authenticate, authorize(MANAGERS));

router.get('/', validate(siteSchema.listSitesSchema), siteController.listSites);

router.post('/', validate(siteSchema.createSiteSchema), siteController.createSite);

router.get('/:siteId', validate(siteSchema.siteIdParamSchema), siteController.getSiteById);

router.put('/:siteId', validate(siteSchema.updateSiteSchema), siteController.updateSite);

router.delete('/:siteId', validate(siteSchema.siteIdParamSchema), siteController.deleteSite);

export default router;