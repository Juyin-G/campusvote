// src/modules/organizations/organization/organization.service.js

import orgRepository from './organization.repository.js';
import { ApiError } from '../../../shared/errors/index.js';
import { ROLES } from '../../../constants/roles.js';

// CAMBIO: separación de campos de plataforma (SUPERADMIN) y de tenant (ADMIN).
// Soportan tanto snake_case (request body) como camelCase (Prisma).
const PLATFORM_FIELDS = new Set([
  'isActive', 'is_active',
  'memberLimit', 'member_limit',
  'defaultLocale', 'default_locale',
]);
const TENANT_FIELDS = new Set([
  'name', 'logo', 'primaryColor', 'primary_color', 'secondaryColor', 'secondary_color',
  'country', 'timezone',
  'allowedEmailDomains', 'allowed_email_domains',
  'categoryCatalog', 'category_catalog',
  'onboardingCompleted', 'onboarding_completed',
  'onboardingCompletedAt', 'onboarding_completed_at',
]);

const isPlatformField = (key) => PLATFORM_FIELDS.has(key);
const isTenantField = (key) => TENANT_FIELDS.has(key);


export const listOrganizations = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit) || 10));
  const skip = (page - 1) * limit;

  let isActive;
  if (query.is_active === 'true') isActive = true;
  else if (query.is_active === 'false') isActive = false;

  const filters = {
    isActive,
    search: query.search,
    skip,
    take: limit,
  };

  const [total, organizations] = await Promise.all([
    orgRepository.countOrgs(filters),
    orgRepository.listOrgs(filters),
  ]);

  return {
    organizations,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
};

/**
 * Obtener organización por ID
 */
export const getOrganizationById = async (id) => {
  const organization = await orgRepository.findOrgById(id);

  if (!organization) {
    throw ApiError.notFound('Organización no encontrada');
  }

  return organization;
};

/**
 * Crear una nueva organización
 */
export const createOrganization = async (data = {}) => {
  const normalizedCode = data.code.trim().toUpperCase();

  const existingOrg = await orgRepository.findOrgByCode(normalizedCode);
  if (existingOrg) {
    throw ApiError.conflict('Ya existe una organización con ese código');
  }

  return orgRepository.createOrg({
    name: data.name.trim(),
    code: normalizedCode,
    orgType: data.org_type ?? 'UNIVERSITY',
    logo: data.logo || null,
    primaryColor: data.primary_color || '#0066CC',
    secondaryColor: data.secondary_color || '#FFD700',
    country: data.country?.trim() || 'Perú',
    timezone: data.timezone?.trim() || 'America/Lima',
    allowedEmailDomains: data.allowed_email_domains || [],
    memberLimit: data.member_limit ?? 100,
  });
};

/**
 * Actualizar una organización
 * CAMBIO: el SUPERADMIN solo puede modificar campos de plataforma
 * (isActive, memberLimit, defaultLocale). Cualquier intento de modificar
 * branding, datos de contacto u operación interna devuelve 403.
 * El ADMIN del propio tenant solo puede modificar campos operativos de su
 * organización (no memberLimit, no isActive).
 */
export const updateOrganization = async (id, data = {}, actor = {}) => {
  const isSuperAdmin = actor?.role === ROLES.SUPERADMIN || actor?.isSuperuser || actor?.isSuperAdmin;
  const isAdmin = actor?.role === ROLES.ADMIN;

  if (!isSuperAdmin && !isAdmin) {
    throw ApiError.forbidden('No tienes permisos para editar organizaciones');
  }

  if (isAdmin && actor?.organizationId !== id) {
    throw ApiError.forbidden('Solo puedes actualizar la identidad de tu organización');
  }

  // CAMBIO: SUPERADMIN limitado a platform fields. Bloqueo explícito si
  // intenta tocar campos de tenant (branding, allowedEmailDomains, etc.).
  if (isSuperAdmin) {
    for (const key of Object.keys(data)) {
      if (isTenantField(key)) {
        throw ApiError.forbidden(
          'El administrador de plataforma solo puede modificar campos de plataforma (isActive, memberLimit, defaultLocale)'
        );
      }
      if (!isPlatformField(key)) {
        throw ApiError.forbidden(
          `El campo "${key}" no es modificable por el administrador de plataforma`
        );
      }
    }
  }

  const existingOrg = await orgRepository.findOrgById(id);
  if (!existingOrg) {
    throw ApiError.notFound('Organización no encontrada');
  }

  const updateData = {};

  if (data.name !== undefined) updateData.name = data.name.trim();

  if (data.code !== undefined) {
    const normalizedCode = data.code.trim().toUpperCase();
    if (normalizedCode !== existingOrg.code) {
      const codeInUse = await orgRepository.findOrgByCode(normalizedCode);
      if (codeInUse) {
        throw ApiError.conflict('Ya existe una organización con ese código');
      }
    }
    updateData.code = normalizedCode;
  }

  if (data.org_type !== undefined) updateData.orgType = data.org_type;
  if (data.logo !== undefined) updateData.logo = data.logo || null;
  if (data.primary_color !== undefined) updateData.primaryColor = data.primary_color;
  if (data.secondary_color !== undefined) updateData.secondaryColor = data.secondary_color;
  if (data.country !== undefined) updateData.country = data.country.trim();
  if (data.timezone !== undefined) updateData.timezone = data.timezone.trim();
  if (data.is_active !== undefined) updateData.isActive = data.is_active;

  if (data.onboarding_completed !== undefined) {
    updateData.onboardingCompleted = data.onboarding_completed;
    updateData.onboardingCompletedAt = data.onboarding_completed ? new Date() : null;
  }

  if (data.allowed_email_domains !== undefined) {
    updateData.allowedEmailDomains = data.allowed_email_domains;
  }

  if (data.default_locale !== undefined) {
    updateData.defaultLocale = data.default_locale;
  }

  if (data.member_limit !== undefined) {
    if (!isSuperAdmin) {
      throw ApiError.forbidden('Solo el SUPERADMIN puede modificar la capacidad de una organización');
    }
    const currentMembers = await orgRepository.countOrganizationMembers(id);
    if (data.member_limit < currentMembers) {
      throw ApiError.badRequest(
        `La capacidad no puede ser menor que los ${currentMembers} miembros actuales`
      );
    }
    updateData.memberLimit = data.member_limit;
  }

  if (Object.keys(updateData).length === 0) {
    throw ApiError.badRequest('No se proporcionaron datos para actualizar');
  }

  return orgRepository.updateOrg(id, updateData);
};

/**
 * Eliminar una organización por ID
 */
export const deleteOrganization = async (id) => {
  const existingOrg = await orgRepository.findOrgById(id);
  if (!existingOrg) {
    throw ApiError.notFound('Organización no encontrada');
  }

  return orgRepository.deleteOrgById(id);
};

/**
 * Actualizar datos específicos del proceso de onboarding
 */
export const updateOnboarding = async (organizationId, data = {}) => {
  const existingOrg = await orgRepository.findOrgById(organizationId);
  if (!existingOrg) {
    throw ApiError.notFound('Organización no encontrada');
  }

  const updateData = {};

  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.logo !== undefined) updateData.logo = data.logo || null;
  if (data.primary_color !== undefined) updateData.primaryColor = data.primary_color;
  if (data.secondary_color !== undefined) updateData.secondaryColor = data.secondary_color;
  if (data.country !== undefined) updateData.country = data.country.trim();
  if (data.timezone !== undefined) updateData.timezone = data.timezone.trim();

  if (Object.keys(updateData).length === 0) {
    throw ApiError.badRequest('No se proporcionaron datos para actualizar');
  }

  return orgRepository.updateOrg(organizationId, updateData);
};

/**
 * Marcar onboarding como completado
 */
export const completeOnboarding = async (organizationId) => {
  const existingOrg = await orgRepository.findOrgById(organizationId);
  if (!existingOrg) {
    throw ApiError.notFound('Organización no encontrada');
  }

  if (existingOrg.onboardingCompleted) { 
    throw ApiError.badRequest('El onboarding de esta organización ya fue completado');
  }

  return orgRepository.completeOrgOnboarding(organizationId);
};

export default {
  listOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  updateOnboarding,
  completeOnboarding,
};