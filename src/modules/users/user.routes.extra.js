// src/modules/users/user.routes.extra.js
// Rutas adicionales: asignación de sede + asignación académica + PDF del lote.
// Separadas para mantener user.routes.js delgado.

import express from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { prisma } from '../../database/prisma.js';
import { requireActorCanActOnUser } from '../../middlewares/tenantScope.middleware.js';
import { actorHasSiteAccess } from '../../services/adminScope.service.js';
import { updateAcademic, bulkPdf } from './user.controller.js';
import { assignAcademicSchema, assignSiteSchema } from './user.schema.js';
import { blockSuperAdminOnTenantRoute } from './user.guards.js';

const router = express.Router();

// PUT /:id/site → asignar/reemplazar sedes del usuario.
router.put(
  '/:id/site',
  authenticate,
  authorize(ROLES.ADMIN),
  requireActorCanActOnUser('id'),
  validate(assignSiteSchema),
  async (req, res, next) => {
    try {
      const siteIds = req.body.site_ids || [];
      if (req.user.scopeLevel === 'SITE') {
        for (const s of siteIds) {
          const ok = await actorHasSiteAccess(req.user, s);
          if (!ok) {
            return next(ApiError.forbidden(`No tienes acceso a la sede ${s}`));
          }
        }
      }
      await prisma.$transaction([
        prisma.userSiteAssignment.deleteMany({ where: { userId: req.params.id } }),
        prisma.userSiteAssignment.createMany({
          data: siteIds.map((siteId) => ({
            userId: req.params.id,
            siteId,
            grantedBy: req.user?.id || req.user?.userId,
          })),
        }),
      ]);
      const refreshed = await prisma.user.findUnique({
        where: { id: req.params.id },
        include: { siteAssignments: true },
      });
      res.json({ user: refreshed });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /:id/academic → datos académicos (program_id, career_id, faculty_id, cycle).
router.put(
  '/:id/academic',
  authenticate,
  authorize(ROLES.ADMIN),
  requireActorCanActOnUser('id'),
  validate(assignAcademicSchema),
  updateAcademic
);

// POST /bulk/pdf → PDF consolidado del lote (solo ADMIN ORG).
router.post(
  '/bulk/pdf',
  authenticate,
  authorize(ROLES.ADMIN),
  blockSuperAdminOnTenantRoute,
  bulkPdf
);

export default router;
