// src/modules/organizations/organization-request/request.service.js

import * as organizationRepository from '../organization/organization.repository.js'; // Ajusta la ruta según tu estructura
import { ApiError } from '../../../shared/errors/ApiError.js';
import {
  prismaPagination,
  parsePagination,
} from '../../../shared/utils/pagination.js';
import MESSAGES from '../../../constants/messages.js';
import { createOrganizationRequestSchema } from './organization.schema.js';
import { sendRequestReceived } from '../../../shared/services/email.service.js';
import logger from '../../../config/logger.js';

/**
 * Registrar una nueva solicitud de organización.
 * Nace siempre en estado PENDING (valor por defecto en la BD).
 */
export const createRequest = async (data = {}) => {
  // Validación con Zod (lanza error automático si algo falla)
  const validatedData = createOrganizationRequestSchema.parse({ body: data }).body;

  // Mapeo a camelCase para Prisma
  const prismaData = {
    institutionName: validatedData.institution_name,
    institutionType: validatedData.institution_type,
    country: validatedData.country,
    estimatedMembers: validatedData.estimated_members,
    contactEmail: validatedData.contact_email,
    contactPhone: validatedData.contact_phone || null,
    message: validatedData.message || null,
    status: 'PENDING',
  };

  try {
    const created = await organizationRepository.createRequest(prismaData);

    /**
     * Email automático al visitante. Es secundario a la persistencia: si Gmail
     * falla (rate-limit, credencial revocada, etc.), la solicitud queda
     * registrada y el backend responde 201 igual. Solo se loguea como warning.
     */
    try {
      await sendRequestReceived({
        email: created.contactEmail,
        institutionName: created.institutionName,
      });
    } catch (emailErr) {
      logger.warn('No se pudo enviar email de solicitud recibida', {
        requestId: created.id,
        email: created.contactEmail,
        error: emailErr.message,
      });
    }

    return created;
  } catch (err) {
    if (err?.code === 'P2002') {
      throw ApiError.conflict('Ya existe una solicitud con ese correo electrónico');
    }
    throw err;
  }
};

/**
 * Listar solicitudes paginadas, con filtro opcional por estado.
 */
export const listRequests = async (query = {}) => {
  const { page, limit } = parsePagination(query);
  const { skip, take } = prismaPagination({ page, limit });

  const status = query.status || undefined;

  const [total, requests] = await Promise.all([
    organizationRepository.countRequests({ status }),
    organizationRepository.listRequests({ status, skip, take }),
  ]);

  return {
    requests,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
};

/**
 * Obtener una solicitud por ID.
 */
export const getRequestById = async (id) => {
  const request = await organizationRepository.findRequestById(id);

  if (!request) {
    throw ApiError.notFound(MESSAGES.ORGANIZATION?.REQUEST_NOT_FOUND || 'Solicitud de organización no encontrada');
  }

  return request;
};

export default {
  createRequest,
  listRequests,
  getRequestById,
};