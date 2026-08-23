const orgRepository = require('./organization.repository');
const { ApiError } = require('../../shared/errors');

/**
 * Listar organizaciones paginadas usando el repositorio
 */
const listOrganizations = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit) || 10));
  const skip = (page - 1) * limit;

  const filters = {
    is_active: query.is_active,
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
const getOrganizationById = async (id) => {
  const organization = await orgRepository.findOrgById(id);

  if (!organization) {
    throw ApiError.notFound('Organización no encontrada');
  }

  return organization;
};

/**
 * Crear una nueva organización
 */
const createOrganization = async (data = {}) => {
  const normalizedCode = data.code.trim().toUpperCase();

  const existingOrg = await orgRepository.findOrgByCode(normalizedCode);
  if (existingOrg) {
    throw ApiError.conflict('Ya existe una organización con ese código');
  }

  return orgRepository.createOrg({
    name: data.name.trim(),
    code: normalizedCode,
    org_type: data.org_type ?? 'UNIVERSITY',
    logo: data.logo || null,
    primary_color: data.primary_color || '#0066CC',
    secondary_color: data.secondary_color || '#FFD700',
    country: data.country?.trim() || 'Perú',
    timezone: data.timezone?.trim() || 'America/Lima',
  });
};

/**
 * Actualizar una organización
 */
const updateOrganization = async (id, data = {}) => {
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

  if (data.org_type !== undefined) updateData.org_type = data.org_type;
  if (data.logo !== undefined) updateData.logo = data.logo || null;
  if (data.primary_color !== undefined) updateData.primary_color = data.primary_color;
  if (data.secondary_color !== undefined) updateData.secondary_color = data.secondary_color;
  if (data.country !== undefined) updateData.country = data.country.trim();
  if (data.timezone !== undefined) updateData.timezone = data.timezone.trim();
  if (data.is_active !== undefined) updateData.is_active = data.is_active;

  if (data.onboarding_completed !== undefined) {
    updateData.onboarding_completed = data.onboarding_completed;
    updateData.onboarding_completed_at = data.onboarding_completed ? new Date() : null;
  }

  if (Object.keys(updateData).length === 0) {
    throw ApiError.badRequest('No se proporcionaron datos para actualizar');
  }

  return orgRepository.updateOrg(id, updateData);
};

/**
 * Eliminar una organización por ID
 */
const deleteOrganization = async (id) => {
  const existingOrg = await orgRepository.findOrgById(id);
  if (!existingOrg) {
    throw ApiError.notFound('Organización no encontrada');
  }

  return orgRepository.deleteOrgById(id);
};

/**
 * Actualizar datos específicos del proceso de onboarding
 */
const updateOnboarding = async (organizationId, data = {}) => {
  const existingOrg = await orgRepository.findOrgById(organizationId);
  if (!existingOrg) {
    throw ApiError.notFound('Organización no encontrada');
  }

  const updateData = {};

  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.logo !== undefined) updateData.logo = data.logo || null;
  if (data.primary_color !== undefined) updateData.primary_color = data.primary_color;
  if (data.secondary_color !== undefined) updateData.secondary_color = data.secondary_color;
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
const completeOnboarding = async (organizationId) => {
  const existingOrg = await orgRepository.findOrgById(organizationId);
  if (!existingOrg) {
    throw ApiError.notFound('Organización no encontrada');
  }

  if (existingOrg.onboarding_completed) {
    throw ApiError.badRequest('El onboarding de esta organización ya fue completado');
  }

  return orgRepository.completeOrgOnboarding(organizationId);
};

module.exports = {
  listOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  updateOnboarding,
  completeOnboarding,
};