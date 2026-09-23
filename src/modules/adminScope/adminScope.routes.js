// src/modules/adminScope/adminScope.routes.js
// Rutas REST para gestión de scope multi-sede de administradores.
// Solo un ADMIN con scope ≥ al del usuario objetivo puede crear/asignar
// administradores de tenant (jerarquía ORG > REGION > SITE).
//
// Endpoints:
//   GET    /api/admin/admins                  → lista admins del tenant
//   POST   /api/admin/admins                  → crea ADMIN (ORG/REGION/SITE)
//   PATCH  /api/admin/admins/:id/scope        → cambia scope de un ADMIN
//   DELETE /api/admin/admins/:id              → suspende/desactiva un ADMIN
//   PUT    /api/admin/admins/:id/sites        → reemplaza asignaciones SITE
//   POST   /api/admin/sites/:siteId/admins    → asigna admins SITE a una sede

import { Router } from 'express';
import {
  canCreateScope,
  resolveAccessibleSites,
  assignSiteScopes,
} from '../../services/adminScope.service.js';
import { buildScopeUserWhere as adminScopeBuildUserWhere } from '../../middlewares/tenantScope.middleware.js';
import * as userService from '../users/user.service.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { prisma } from '../../database/prisma.js';
import { z } from 'zod';

const router = Router();

const adminCreateSchema = z.object({
  body: z.object({
    username: z.string().min(3).max(50),
    email: z.string().email(),
    password: z.string().min(8),
    first_name: z.string().min(1).max(50),
    last_name: z.string().min(1).max(50),
    organization_id: z.string().uuid(),
    institutional_id: z.string().optional(),
    scope_level: z.enum(['ORG', 'REGION', 'SITE']),
    region_id: z.string().uuid().optional(),
    site_ids: z.array(z.string().uuid()).optional(),
    document_type: z.enum(['DNI', 'CE']).optional(),
    document_number: z.string().optional(),
  }),
});

const adminScopePatchSchema = z.object({
  body: z.object({
    scope_level: z.enum(['ORG', 'REGION', 'SITE']).optional(),
    region_id: z.string().uuid().optional(),
    site_ids: z.array(z.string().uuid()).optional(),
  }).refine((d) => d.scope_level || d.region_id || (d.site_ids && d.site_ids.length > 0), {
    message: 'Indica scope_level, region_id o site_ids',
  }),
});

const adminSitesSchema = z.object({
  body: z.object({
    site_ids: z.array(z.string().uuid()),
  }),
});

const buildAdminResponse = (u) => ({
  id: u.id,
  email: u.email,
  username: u.username,
  firstName: u.firstName,
  lastName: u.lastName,
  role: u.role,
  organizationId: u.organizationId,
  scopeLevel: u.scopeLevel,
  regionId: u.regionId,
  status: u.status,
  mustChangePassword: u.mustChangePassword,
  siteIds: u.siteAssignments?.map((s) => s.siteId) || [],
});

router.use(authenticate);

const isSuperUser = (actor) =>
  actor?.isSuperuser || actor?.isSuperAdmin || actor?.role === ROLES.SUPERADMIN;

// GET /api/admin/admins — lista admins del tenant (filtrado por scope).
// La cobertura multi-sede (REGION/SITE) la aplica buildScopeUserWhere.
router.get('/admins', authorize(ROLES.ADMIN), async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    if (!organizationId) {
      throw ApiError.badRequest('organization_id requerido');
    }

    const where = {
      organizationId,
      role: ROLES.ADMIN,
      // Filtrar por scope ORG/REGION/SITE.
      ...(await adminScopeBuildUserWhere(req.user)),
    };
    const users = await prisma.user.findMany({
      where,
      include: { siteAssignments: true, region: true },
      orderBy: { firstName: 'asc' },
    });

    res.json({ admins: users.map(buildAdminResponse), total: users.length });
  } catch (e) {
    next(e);
  }
});

// POST /api/admin/admins — crea un ADMIN con scope.
router.post(
  '/admins',
  authorize(ROLES.ADMIN),
  validate(adminCreateSchema),
  async (req, res, next) => {
    try {
      const body = req.body;

      // Aislamiento tenant: el ADMIN solo crea dentro de su organización.
      if (body.organization_id !== req.user.organizationId) {
        throw ApiError.forbidden('Solo puedes crear administradores dentro de tu organización');
      }

      await canCreateScope(req.user, {
        role: ROLES.ADMIN,
        organizationId: body.organization_id,
        scopeLevel: body.scope_level,
        regionId: body.region_id || null,
        siteIds: body.site_ids || [],
      });

      const newUser = await userService.createUser(body, req.user);
      res.status(201).json({ admin: buildAdminResponse(newUser) });
    } catch (e) {
      next(e);
    }
  }
);

// PATCH /api/admin/admins/:id/scope — cambia el scope de un ADMIN existente.
router.patch(
  '/admins/:id/scope',
  authorize(ROLES.ADMIN),
  validate(adminScopePatchSchema),
  async (req, res, next) => {
    try {
      const target = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          role: true,
          organizationId: true,
          scopeLevel: true,
          regionId: true,
        },
      });
      if (!target) throw ApiError.notFound('Administrador no encontrado');
      if (target.role !== ROLES.ADMIN) {
        throw ApiError.badRequest('El usuario objetivo no es un administrador');
      }

      if (target.organizationId !== req.user.organizationId) {
        throw ApiError.forbidden('Administrador de otra organización');
      }

      // Validar que el actor pueda crear el nuevo scope hipotético.
      await canCreateScope(req.user, {
        role: ROLES.ADMIN,
        organizationId: target.organizationId,
        scopeLevel: req.body.scope_level || target.scopeLevel,
        regionId: req.body.region_id || target.regionId,
        siteIds: req.body.site_ids || [],
      });

      await prisma.user.update({
        where: { id: target.id },
        data: {
          scopeLevel: req.body.scope_level || undefined,
          regionId: req.body.region_id || undefined,
        },
      });

      // Si hay site_ids y el scope es SITE, reemplazar asignaciones.
      if (req.body.site_ids && req.body.site_ids.length > 0) {
        await assignSiteScopes({
          actor: req.user,
          targetUserId: target.id,
          siteIds: req.body.site_ids,
        });
      }

      const refreshed = await prisma.user.findUnique({
        where: { id: target.id },
        include: { siteAssignments: true },
      });
      res.json({ admin: buildAdminResponse(refreshed) });
    } catch (e) {
      next(e);
    }
  }
);

// PUT /api/admin/admins/:id/sites — reemplaza asignaciones SITE de un ADMIN.
router.put(
  '/admins/:id/sites',
  authorize(ROLES.ADMIN),
  validate(adminSitesSchema),
  async (req, res, next) => {
    try {
      await assignSiteScopes({
        actor: req.user,
        targetUserId: req.params.id,
        siteIds: req.body.site_ids,
      });
      const refreshed = await prisma.user.findUnique({
        where: { id: req.params.id },
        include: { siteAssignments: true },
      });
      res.json({ admin: buildAdminResponse(refreshed) });
    } catch (e) {
      next(e);
    }
  }
);

// DELETE /api/admin/admins/:id — suspende a un administrador.
router.delete(
  '/admins/:id',
  authorize(ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const target = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: { id: true, role: true, organizationId: true },
      });
      if (!target) throw ApiError.notFound('Administrador no encontrado');
      if (target.role !== ROLES.ADMIN) {
        throw ApiError.badRequest('El usuario objetivo no es un administrador');
      }
      if (target.organizationId !== req.user.organizationId) {
        throw ApiError.forbidden('Administrador de otra organización');
      }
      await prisma.user.update({
        where: { id: target.id },
        data: { status: 'SUSPENDED' },
      });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  }
);

// GET /api/admin/sites — lista las sedes del tenant (filtradas por scope).
router.get('/sites', authorize(ROLES.ADMIN), async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    if (!organizationId) throw ApiError.badRequest('Sin organización');

    // ADMIN ORG ve todas; REGION/SITE solo ve sus sedes.
    const accessible = await resolveAccessibleSites(req.user);
    let sites;
    if (!accessible) {
      sites = await prisma.organizationSite.findMany({
        where: { organizationId },
        include: { region: true },
      });
    } else {
      const siteIds = accessible.map((s) => s.siteId);
      sites = await prisma.organizationSite.findMany({
        where: { id: { in: siteIds } },
        include: { region: true },
      });
    }
    res.json({ sites });
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/regions — lista las regiones accesibles para el actor.
// ORG ve todas; REGION ve su propia región; SITE las regiones de sus sedes.
router.get('/regions', authorize(ROLES.ADMIN), async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    if (!organizationId) throw ApiError.badRequest('Sin organización');

    let regionIds = null;
    if (req.user.scopeLevel === 'REGION' && req.user.regionId) {
      regionIds = [req.user.regionId];
    } else if (req.user.scopeLevel === 'SITE') {
      const accessible = await resolveAccessibleSites(req.user);
      regionIds = [...new Set(accessible.map((s) => s.regionId).filter(Boolean))];
    }

    const where = regionIds
      ? { id: { in: regionIds }, organizationId }
      : { organizationId };
    const regions = await prisma.region.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    res.json({ regions });
  } catch (e) {
    next(e);
  }
});

export default router;
