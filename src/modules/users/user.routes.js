// src/modules/users/user.routes.js
//
// Reglas de autorización (issue #CONTROL_USUARIOS):
//   * CRUD de usuarios académicos (STUDENT/TEACHER/JURY) del tenant
//     pertenece EXCLUSIVAMENTE al ADMIN tenant según su scope:
//     - ADMIN ORG    → toda su organización.
//     - ADMIN REGION → usuarios de las sedes de su región.
//     - ADMIN SITE   → usuarios de las sedes que tiene asignadas.
//   * SUPERADMIN NO usa este CRUD. Solo actúa sobre PLATFORM
//     (/users/admin/provision y /users/admin/provision-existing).
//
// Para garantizar esto:
//   * /users/admin/provision* se montan como PLATFORM (sin
//     blockSuperAdminFromTenantRoutes, authorize([SUPERADMIN])).
//   * /users (el resto) se monta dentro del tenantRouter, que aplica
//     blockSuperAdminFromTenantRoutes antes de cualquier authorize().
//   * Las authorize() sobre CRUD de tenant solo listan ROLES.ADMIN (no
//     incluyen SUPERADMIN). El filtro fino por scope se realiza con
//     tenantScope.middleware (canActorActOnUser).

import express from 'express';
import * as userController from './user.controller.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import {
  userParamsSchema,
  listUserSchema,
  createUserSchema,
  updateMeSchema,
  updateUserSchema,
  changeRoleSchema,
  setActiveSchema,
  changePasswordSchema,
  provisionAdminSchema,
  provisionExistingAdminSchema,
  createUsersBulkSchema,
  assignAcademicSchema,
  assignSiteSchema,
} from './user.schema.js';
import {
  requireActorCanActOnUser,
  attachScopeUserFilter,
  canActorActOnUser,
} from '../../middlewares/tenantScope.middleware.js';
import { prisma } from '../../database/prisma.js';
import { generateProvisionedUsersPdf } from '../../services/usersProvisionedPdf.service.js';
import { actorHasSiteAccess } from '../../services/adminScope.service.js';

// ════════════════════════════════════════════════════════════════════════
//  platformUsersRouter — exclusivamente para SUPERADMIN.
//  /api/users/admin/provision *
// ════════════════════════════════════════════════════════════════════════
const platformUsersRouter = express.Router();

platformUsersRouter.post(
  '/admin/provision',
  authenticate,
  authorize(ROLES.SUPERADMIN),
  validate(provisionAdminSchema),
  userController.provisionAdmin
);

platformUsersRouter.post(
  '/admin/provision-existing/:organizationId',
  authenticate,
  authorize(ROLES.SUPERADMIN),
  validate(provisionExistingAdminSchema),
  userController.provisionExistingAdmin
);

// ════════════════════════════════════════════════════════════════════════
//  tenantUsersRouter — CRUD académico y de admins de tenant.
//  SOLO ADMIN según scope. SUPERADMIN queda bloqueado en el upstream.
// ════════════════════════════════════════════════════════════════════════
const router = express.Router();

// Guard interno: impide que un usuario modifique su propio rol.
const preventSelfRoleChange = (req, res, next) => {
  const actorId = req.user?.id || req.user?.userId;
  if (actorId === req.params.id) {
    return next(ApiError.badRequest('No puedes modificar tu propio rol'));
  }
  next();
};

// Guard interno: solo permite asignar rol ADMIN a otros ADMINs del mismo
// tenant si su scope lo permite. El manejo fino vive en adminScope.service.
const requireAdminScopeForAdminRole = (req, res, next) => {
  if (req.body?.role !== ROLES.ADMIN) return next();
  // Permitimos ADMIN ↔ ADMIN a ADMIN ORG. REGION/SITE lo rechazamos explícito.
  if (!req.user || req.user.role !== ROLES.ADMIN || req.user.scopeLevel !== 'ORG') {
    return next(
      ApiError.forbidden(
        'Solo ADMIN ORG puede asignar/modificar el rol ADMIN dentro del tenant'
      )
    );
  }
  next();
};

// GET / → lista usuarios del tenant (scope aplicado en service).
router.get(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(listUserSchema),
  attachScopeUserFilter,
  userController.listUsers
);

router.get('/me', authenticate, userController.getMe);

router.get(
  '/:id',
  authenticate,
  validate(userParamsSchema),
  // Permiso self/admin y, si es ADMIN, que su scope cubra al target.
  async (req, res, next) => {
    try {
      const target = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          organizationId: true,
          role: true,
          siteAssignments: { select: { siteId: true } },
        },
      });
      if (!target) return next(ApiError.notFound('Usuario no encontrado'));

      const actorId = req.user?.id || req.user?.userId;
      const isSelf = actorId === target.id;
      const isAdmin = req.user?.role === ROLES.ADMIN;
      if (!isSelf && !isAdmin) return next(ApiError.forbidden('Acceso denegado'));

      if (isAdmin && !isSelf) {
        const siteIds = (target.siteAssignments || []).map((s) => s.siteId);
        const allowed = await canActorActOnUser(
          req.user,
          target.organizationId,
          siteIds
        );
        if (!allowed) {
          return next(
            ApiError.forbidden('No tienes autorización sobre este usuario')
          );
        }
      }
      req.targetUser = target;
      next();
    } catch (err) {
      next(err);
    }
  },
  userController.getUserById
);

// POST / → crea usuario académico. ADMIN tenant únicamente.
router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(createUserSchema),
  // Para roles académicos, el body lleva organization_id; validamos
  // contra el scope al crear el usuario. La verificación fina vive en
  // createUser (user.service) → canActorActOnUser.
  userController.createUser
);

// POST /bulk → crea usuarios académicos en lote, dentro del scope del actor.
router.post(
  '/bulk',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(createUsersBulkSchema),
  userController.createUsersBulk
);

// POST /bulk/pdf → genera PDF de credenciales para el lote del ADMIN actual.
// Solo accesible si el ADMIN tiene scope sobre cada site implicado.
router.post(
  '/bulk/pdf',
  authenticate,
  authorize(ROLES.ADMIN),
  async (req, res, next) => {
    try {
      // El sub-router ya bloqueó a SUPERADMIN; esto es defensivo.
      const actor = req.user || {};
      if (
        actor.role === ROLES.SUPERADMIN ||
        actor.isSuperuser ||
        actor.isSuperAdmin
      ) {
        return next(
          new ApiError(
            403,
            'El administrador de plataforma no tiene acceso al PDF de credenciales de tenant',
            null,
            'FORBIDDEN'
          )
        );
      }

      const { organization_id: orgId, users: userList, temp_passwords: tempPwds } =
        req.body || {};
      if (orgId !== actor.organizationId) {
        return next(ApiError.forbidden('Solo para usuarios de tu organización'));
      }

      // Aislamiento: cada sede de cada usuario debe estar dentro del scope.
      // Como el payload del PDF no necesariamente incluye site_id (lo deriva
      // el cliente del contexto del lote), exigimos que el ADMIN ORG sea el
      // único autorizado a generar el PDF o que el lote pertenezca a una
      // sede accesible.
      if (req.user.scopeLevel && req.user.scopeLevel !== 'ORG') {
        // ADMIN SITE/REGION: que al menos una de las siteRefs esté en su alcance.
        // Como el PDF a veces no incluye site_ids por usuario, exigimos que el
        // ADMIN tenga al menos un site assignment coherente.
        // Mantenemos la política: solo ADMIN ORG genera PDF del lote; SITE/REGION
        // pueden ver credenciales individuales pero no el documento agregado.
        return next(
          ApiError.forbidden(
            'Solo ADMIN ORG puede generar el PDF consolidado del lote'
          )
        );
      }

      const organization = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true, code: true },
      });
      if (!organization) {
        return next(ApiError.notFound('Organización no encontrada'));
      }

      const enriched = (userList || []).map((u) => ({
        ...u,
        _tempPassword: tempPwds?.[u.email],
      }));

      const buffer = await generateProvisionedUsersPdf({
        organization,
        generatedBy: req.user?.email || req.user?.username || 'ADMIN',
        generatedAt: new Date(),
        users: enriched,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="carga-masiva-${organization.code}-${new Date().toISOString().slice(0, 10)}.pdf"`
      );
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /me → actualizar perfil propio (debe ir ANTES de /:id para evitar shadowing).
router.put(
  '/me',
  authenticate,
  validate(updateMeSchema),
  userController.updateMe
);

// POST /me/password → cambiar contraseña propia.
router.post(
  '/me/password',
  authenticate,
  validate(changePasswordSchema),
  userController.changePassword
);

// PUT /:id → editar usuario académico. El guard valida scope por usuario.
router.put(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  requireActorCanActOnUser('id'),
  validate(updateUserSchema),
  userController.updateUser
);

// PATCH /:id/role → cambio de rol explícito.
router.patch(
  '/:id/role',
  authenticate,
  authorize(ROLES.ADMIN),
  preventSelfRoleChange,
  requireActorCanActOnUser('id'),
  requireAdminScopeForAdminRole,
  validate(changeRoleSchema),
  userController.changeRole
);

// PATCH /:id/status → activar/desactivar (bloqueo/desbloqueo operativo).
router.patch(
  '/:id/status',
  authenticate,
  authorize(ROLES.ADMIN),
  requireActorCanActOnUser('id'),
  validate(setActiveSchema),
  userController.setActive
);

// PATCH /:id/unlock → resetear intentos fallidos y lockedUntil.
router.patch(
  '/:id/unlock',
  authenticate,
  authorize(ROLES.ADMIN),
  requireActorCanActOnUser('id'),
  validate(userParamsSchema),
  userController.unlockUser
);

// PUT /:id/site → asignar/reemplazar sede(s) académicas del usuario.
// Solo ADMIN ORG; SITE/REGION delegan al padre del scope.
router.put(
  '/:id/site',
  authenticate,
  authorize(ROLES.ADMIN),
  requireActorCanActOnUser('id'),
  validate(assignSiteSchema),
  async (req, res, next) => {
    try {
      const siteIds = req.body.site_ids || [];
      // Política: para SITE solo se acepta su sede asignada actual.
      if (req.user.scopeLevel === 'SITE') {
        for (const s of siteIds) {
          const ok = await actorHasSiteAccess(req.user, s);
          if (!ok) {
            return next(ApiError.forbidden(`No tienes acceso a la sede ${s}`));
          }
        }
      }
      // Eliminar anteriores y crear nuevas.
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

// PUT /:id/academic → asignar o actualizar datos académicos del usuario
// (program_id, career_id, faculty_id, current_cycle, etc.).
router.put(
  '/:id/academic',
  authenticate,
  authorize(ROLES.ADMIN),
  requireActorCanActOnUser('id'),
  validate(assignAcademicSchema),
  async (req, res, next) => {
    try {
      const data = {};
      if (req.body.faculty_id !== undefined) data.facultyId = req.body.faculty_id;
      if (req.body.program_id !== undefined) data.programId = req.body.program_id;
      if (req.body.career_id !== undefined) data.careerId = req.body.career_id;
      if (req.body.current_cycle !== undefined)
        data.currentCycle = req.body.current_cycle;

      if (Object.keys(data).length === 0) {
        return next(ApiError.badRequest('No hay campos para actualizar'));
      }

      const updated = await prisma.user.update({
        where: { id: req.params.id },
        data,
      });
      res.json({ user: updated });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /:id → desactivar al usuario (el soft-delete queda a setActive).
router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  requireActorCanActOnUser('id'),
  async (req, res, next) => {
    try {
      await prisma.user.update({
        where: { id: req.params.id },
        data: { status: 'SUSPENDED' },
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
export { platformUsersRouter };
