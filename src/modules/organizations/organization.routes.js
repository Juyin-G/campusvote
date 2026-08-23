const { Router } = require('express');

// Controladores separados por subdominio
const {
  getOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  updateOnboarding,
  completeOnboarding,
} = require('./organization.controller');

const {
  getOrganizationRequests,
  createOrganizationRequest,
  approveOrganizationRequest,
  rejectOrganizationRequest,
} = require('./organization-request.controller');

// Middlewares
const { authenticate, optionalAuthenticate, authorize } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate.middleware');

// Schemas
const {
  idParamSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
  createOrganizationRequestSchema,
  rejectReasonBodySchema,
} = require('./organization.schema');

const router = Router();

// --- SOLICITUDES / LEADS ---

router.get('/requests', authenticate, authorize('ADMIN'), getOrganizationRequests);

router.post(
  '/requests',
  validate(createOrganizationRequestSchema),
  createOrganizationRequest
);

router.patch(
  '/requests/:id/approve',
  authenticate,
  authorize('ADMIN'),
  validate(idParamSchema, 'params'),
  approveOrganizationRequest
);

router.patch(
  '/requests/:id/reject',
  authenticate,
  authorize('ADMIN'),
  validate(idParamSchema, 'params'),
  validate(rejectReasonBodySchema, 'body'),
  rejectOrganizationRequest
);

// --- ORGANIZACIONES ---

router.get('/', optionalAuthenticate, getOrganizations);

router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate(createOrganizationSchema),
  createOrganization
);

router.get('/:id', optionalAuthenticate, validate(idParamSchema, 'params'), getOrganizationById);

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN'),
  validate(idParamSchema, 'params'),
  validate(updateOrganizationSchema),
  updateOrganization
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate(idParamSchema, 'params'),
  deleteOrganization
);

// --- ONBOARDING ---

router.patch(
  '/:id/onboarding',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN'),
  validate(idParamSchema, 'params'),
  updateOnboarding
);

router.post(
  '/:id/onboarding/complete',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN'),
  validate(idParamSchema, 'params'),
  completeOnboarding
);

module.exports = router;