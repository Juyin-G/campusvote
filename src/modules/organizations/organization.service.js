// src/modules/organizations/organization.service.js

import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import {
  prismaPagination,
  parsePagination,
} from '../../shared/utils/pagination.js';

const ORGANIZATION_TYPES = [
  'UNIVERSITY',
  'INSTITUTE',
  'SCHOOL',
  'COMPANY',
  'ASSOCIATION',
  'OTHER',
];

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;


/**
 * Valida los datos principales de una organización.
 */
const validateOrganizationData = (data = {}, isUpdate = false) => {
  if (!isUpdate && !data.name?.trim()) {
    throw ApiError.badRequest(
      'El nombre de la organización es obligatorio',
    );
  }

  if (!isUpdate && !data.code?.trim()) {
    throw ApiError.badRequest(
      'El código de la organización es obligatorio',
    );
  }

  if (data.name !== undefined) {
    if (!data.name?.trim()) {
      throw ApiError.badRequest(
        'El nombre de la organización no puede estar vacío',
      );
    }

    if (data.name.trim().length > 200) {
      throw ApiError.badRequest(
        'El nombre de la organización no puede superar los 200 caracteres',
      );
    }
  }

  if (data.code !== undefined) {
    if (!data.code?.trim()) {
      throw ApiError.badRequest(
        'El código de la organización no puede estar vacío',
      );
    }

    if (data.code.trim().length > 30) {
      throw ApiError.badRequest(
        'El código de la organización no puede superar los 30 caracteres',
      );
    }
  }

  if (
    data.org_type &&
    !ORGANIZATION_TYPES.includes(data.org_type)
  ) {
    throw ApiError.badRequest(
      'El tipo de organización no es válido',
    );
  }

  if (
    data.primary_color &&
    !HEX_COLOR_REGEX.test(data.primary_color)
  ) {
    throw ApiError.badRequest(
      'El color primario debe tener formato hexadecimal, por ejemplo #0066CC',
    );
  }

  if (
    data.secondary_color &&
    !HEX_COLOR_REGEX.test(data.secondary_color)
  ) {
    throw ApiError.badRequest(
      'El color secundario debe tener formato hexadecimal, por ejemplo #FFD700',
    );
  }
};


/**
 * Listar organizaciones paginadas.
 */
export const listOrganizations = async (query = {}) => {
  const { page, limit } = parsePagination(query);

  const where = {};

  if (query.org_type) {
    if (!ORGANIZATION_TYPES.includes(query.org_type)) {
      throw ApiError.badRequest(
        'El tipo de organización utilizado como filtro no es válido',
      );
    }

    where.org_type = query.org_type;
  }

  if (query.is_active !== undefined) {
    where.is_active =
      query.is_active === true ||
      query.is_active === 'true';
  }

  if (query.onboarding_completed !== undefined) {
    where.onboarding_completed =
      query.onboarding_completed === true ||
      query.onboarding_completed === 'true';
  }

  if (query.search) {
    const term = query.search.trim();

    where.OR = [
      {
        name: {
          contains: term,
          mode: 'insensitive',
        },
      },
      {
        code: {
          contains: term,
          mode: 'insensitive',
        },
      },
    ];
  }

  const [total, organizations] = await Promise.all([
    prisma.organizations.count({ where }),

    prisma.organizations.findMany({
      where,
      orderBy: {
        created_at: 'desc',
      },
      ...prismaPagination({
        page,
        limit,
      }),
    }),
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
 * Crear una nueva organización.
 */
export const createOrganization = async (data = {}) => {
  validateOrganizationData(data);

  const normalizedCode = data.code
    .trim()
    .toUpperCase();

  const existingOrganization =
    await prisma.organizations.findUnique({
      where: {
        code: normalizedCode,
      },
    });

  if (existingOrganization) {
    throw ApiError.conflict(
      'Ya existe una organización con ese código',
    );
  }

  return prisma.organizations.create({
    data: {
      name: data.name.trim(),
      code: normalizedCode,

      org_type:
        data.org_type ?? 'UNIVERSITY',

      logo:
        data.logo ?? null,

      primary_color:
        data.primary_color ?? '#0066CC',

      secondary_color:
        data.secondary_color ?? '#FFD700',

      country:
        data.country?.trim() || 'Perú',

      timezone:
        data.timezone?.trim() || 'America/Lima',

      is_active: true,

      onboarding_completed: false,
    },
  });
};


/**
 * Obtener organización por ID.
 */
export const getOrganizationById = async (id) => {
  const organization =
    await prisma.organizations.findUnique({
      where: { id },
    });

  if (!organization) {
    throw ApiError.notFound(
      'Organización no encontrada',
    );
  }

  return organization;
};


/**
 * Actualizar una organización.
 */
export const updateOrganization = async (
  id,
  data = {},
) => {
  const existingOrganization =
    await prisma.organizations.findUnique({
      where: { id },
    });

  if (!existingOrganization) {
    throw ApiError.notFound(
      'Organización no encontrada',
    );
  }

  validateOrganizationData(data, true);

  const updateData = {};

  if (data.name !== undefined) {
    updateData.name = data.name.trim();
  }

  if (data.code !== undefined) {
    const normalizedCode = data.code
      .trim()
      .toUpperCase();

    if (normalizedCode !== existingOrganization.code) {
      const organizationWithCode =
        await prisma.organizations.findUnique({
          where: {
            code: normalizedCode,
          },
        });

      if (organizationWithCode) {
        throw ApiError.conflict(
          'Ya existe una organización con ese código',
        );
      }
    }

    updateData.code = normalizedCode;
  }

  if (data.org_type !== undefined) {
    updateData.org_type = data.org_type;
  }

  if (data.logo !== undefined) {
    updateData.logo = data.logo;
  }

  if (data.primary_color !== undefined) {
    updateData.primary_color =
      data.primary_color;
  }

  if (data.secondary_color !== undefined) {
    updateData.secondary_color =
      data.secondary_color;
  }

  if (data.country !== undefined) {
    updateData.country =
      data.country.trim();
  }

  if (data.timezone !== undefined) {
    updateData.timezone =
      data.timezone.trim();
  }

  if (data.is_active !== undefined) {
    updateData.is_active =
      data.is_active;
  }

  if (Object.keys(updateData).length === 0) {
    throw ApiError.badRequest(
      'No se proporcionaron datos para actualizar',
    );
  }

  return prisma.organizations.update({
    where: { id },
    data: updateData,
  });
};


/**
 * Actualizar datos del proceso de onboarding.
 */
export const updateOnboarding = async (
  organizationId,
  data = {},
) => {
  const organization =
    await prisma.organizations.findUnique({
      where: {
        id: organizationId,
      },
    });

  if (!organization) {
    throw ApiError.notFound(
      'Organización no encontrada',
    );
  }

  const updateData = {};

  if (data.name !== undefined) {
    if (!data.name.trim()) {
      throw ApiError.badRequest(
        'El nombre no puede estar vacío',
      );
    }

    updateData.name = data.name.trim();
  }

  if (data.logo !== undefined) {
    updateData.logo = data.logo;
  }

  if (data.primary_color !== undefined) {
    if (!HEX_COLOR_REGEX.test(data.primary_color)) {
      throw ApiError.badRequest(
        'El color primario debe tener formato hexadecimal',
      );
    }

    updateData.primary_color =
      data.primary_color;
  }

  if (data.secondary_color !== undefined) {
    if (!HEX_COLOR_REGEX.test(data.secondary_color)) {
      throw ApiError.badRequest(
        'El color secundario debe tener formato hexadecimal',
      );
    }

    updateData.secondary_color =
      data.secondary_color;
  }

  if (data.country !== undefined) {
    updateData.country =
      data.country.trim();
  }

  if (data.timezone !== undefined) {
    updateData.timezone =
      data.timezone.trim();
  }

  if (Object.keys(updateData).length === 0) {
    throw ApiError.badRequest(
      'No se proporcionaron datos para actualizar',
    );
  }

  return prisma.organizations.update({
    where: {
      id: organizationId,
    },
    data: updateData,
  });
};


/**
 * Completar onboarding.
 */
export const completeOnboarding = async (
  organizationId,
) => {
  const organization =
    await prisma.organizations.findUnique({
      where: {
        id: organizationId,
      },
    });

  if (!organization) {
    throw ApiError.notFound(
      'Organización no encontrada',
    );
  }

  if (organization.onboarding_completed) {
    throw ApiError.badRequest(
      'El onboarding de esta organización ya fue completado',
    );
  }

  return prisma.organizations.update({
    where: {
      id: organizationId,
    },
    data: {
      onboarding_completed: true,
      onboarding_completed_at: new Date(),
    },
  });
};


export default {
  listOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  updateOnboarding,
  completeOnboarding,
};