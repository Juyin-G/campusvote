// src/modules/organizations/request.service.js

import * as organizationRepository from './organization.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import {
  prismaPagination,
  parsePagination,
} from '../../shared/utils/pagination.js';
import MESSAGES from '../../constants/messages.js';

const ORGANIZATION_TYPES = [
  'UNIVERSITY',
  'INSTITUTE',
  'SCHOOL',
  'COMPANY',
  'ASSOCIATION',
  'OTHER',
];

const REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

// Mismo patrón que la restricción chk_req_email_format de la tabla
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/** Devuelve el texto recortado o cadena vacía si no es un string. */
const asText = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Valida los datos de una solicitud de organización.
 * Refleja las restricciones CHECK de la tabla organization_requests.
 */
const validateRequestData = (data = {}) => {
  const institutionName = asText(data.institution_name);
  if (!institutionName) {
    throw ApiError.badRequest('El nombre de la institución es obligatorio');
  }
  if (institutionName.length > 200) {
    throw ApiError.badRequest(
      'El nombre de la institución no puede superar los 200 caracteres',
    );
  }

  if (!data.institution_type) {
    throw ApiError.badRequest('El tipo de institución es obligatorio');
  }
  if (!ORGANIZATION_TYPES.includes(data.institution_type)) {
    throw ApiError.badRequest('El tipo de institución no es válido');
  }

  const country = asText(data.country);
  if (!country) {
    throw ApiError.badRequest('El país es obligatorio');
  }
  if (country.length > 100) {
    throw ApiError.badRequest('El país no puede superar los 100 caracteres');
  }

  const members = Number(data.estimated_members);
  if (!Number.isInteger(members) || members <= 0) {
    throw ApiError.badRequest(
      'El número estimado de miembros debe ser un entero mayor a 0',
    );
  }

  const contactEmail = asText(data.contact_email);
  if (!contactEmail) {
    throw ApiError.badRequest('El correo de contacto es obligatorio');
  }
  if (!EMAIL_REGEX.test(contactEmail)) {
    throw ApiError.badRequest('El correo de contacto no tiene un formato válido');
  }

  if (asText(data.contact_phone).length > 20) {
    throw ApiError.badRequest(
      'El teléfono de contacto no puede superar los 20 caracteres',
    );
  }
};

/**
 * Registrar una nueva solicitud de organización.
 * Nace siempre en estado PENDING (valor por defecto en la BD).
 */
export const createRequest = async (data = {}) => {
  validateRequestData(data);

  return organizationRepository.createRequest({
    institution_name: asText(data.institution_name),
    institution_type: data.institution_type,
    country: asText(data.country),
    estimated_members: Number(data.estimated_members),
    contact_email: asText(data.contact_email).toLowerCase(),
    contact_phone: asText(data.contact_phone) || null,
    message: asText(data.message) || null,
  });
};

/** Listar solicitudes paginadas, con filtro opcional por estado. */
export const listRequests = async (query = {}) => {
  const { page, limit } = parsePagination(query);
  const { skip, take } = prismaPagination({ page, limit });

  const status = asText(query.status) || undefined;
  if (status && !REQUEST_STATUSES.includes(status)) {
    throw ApiError.badRequest('El estado de la solicitud no es válido');
  }

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

/** Obtener una solicitud por ID. */
export const getRequestById = async (id) => {
  const request = await organizationRepository.findRequestById(id);

  if (!request) {
    throw ApiError.notFound(MESSAGES.ORGANIZATION.REQUEST_NOT_FOUND);
  }

  return request;
};

export default {
  createRequest,
  listRequests,
  getRequestById,
};
