// src/modules/organizations/organization-request/request.service.js

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../database/prisma.js';
import * as organizationRepository from '../organization/organization.repository.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { prismaPagination, parsePagination } from '../../../shared/utils/pagination.js';
import MESSAGES from '../../../constants/messages.js';
import { createOrganizationRequestSchema } from './organization.schema.js';
import {
  sendRequestReceived,
  sendAdminApprovalWithCredentials,
} from '../../../shared/services/email.service.js';
import logger from '../../../config/logger.js';
import { ROLES } from '../../../constants/roles.js';

/**
 * Registrar una nueva solicitud de organización.
 */
export const createRequest = async (data = {}) => {
  const validatedData = createOrganizationRequestSchema.parse({ body: data }).body;

  const prismaData = {
    institutionName: validatedData.institution_name,
    institutionType: validatedData.institution_type,
    country: validatedData.country,
    estimatedMembers: validatedData.estimated_members,
    contactEmail: validatedData.contact_email.toLowerCase().trim(),
    contactPhone: validatedData.contact_phone || null,
    message: validatedData.message || null,
    status: 'PENDING',
  };

  try {
    const created = await organizationRepository.createRequest(prismaData);

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
    throw ApiError.notFound(
      MESSAGES.ORGANIZATION?.REQUEST_NOT_FOUND || 'Solicitud de organización no encontrada',
    );
  }
  return request;
};

/**
 * Aprobar una solicitud de organización.
 * Crea la Organización, crea al Usuario Admin, actualiza la solicitud 
 * y envía las credenciales temporales por correo en una sola transacción.
 */
export const approveRequest = async (id, actor = {}) => {
  // 1. Validar permisos de Super Admin
  const isSuperUser =
    actor?.role === ROLES.SUPERADMIN || actor?.isSuperuser || actor?.isSuperAdmin;
  if (!isSuperUser) {
    throw ApiError.forbidden('Solo el Super Admin puede aprobar solicitudes de organización');
  }

  // 2. Obtener y validar la solicitud
  const request = await organizationRepository.findRequestById(id);
  if (!request) {
    throw ApiError.notFound('Solicitud de organización no encontrada');
  }

  if (request.status !== 'PENDING') {
    throw ApiError.badRequest(`La solicitud ya se encuentra en estado ${request.status}`);
  }

  const targetEmail = request.contactEmail.toLowerCase().trim();

  // 3. Verificar que no exista un usuario previo con el correo de contacto
  const existingUser = await prisma.user.findFirst({
    where: { email: targetEmail },
  });
  if (existingUser) {
    throw ApiError.conflict(
      'Ya existe un usuario registrado en el sistema con el correo de la solicitud',
    );
  }

  // 4. Generar credenciales e identificadores únicos seguros
  const emailPrefix = targetEmail.split('@')[0].replace(/[^a-z0-9]/g, '').slice(0, 10);
  const tempUsername = `${emailPrefix || 'admin'}_${crypto.randomBytes(2).toString('hex')}`;
  
  const tempPassword = crypto.randomBytes(5).toString('hex'); // 10 caracteres hex
  const hashedPassword = await bcrypt.hash(tempPassword, 12);

  const orgPrefix = request.institutionName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase() || 'ORG';
  const orgCode = `${orgPrefix}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  const activationToken = crypto.randomBytes(32).toString('hex');

  let result;

  try {
    // 5. Transacción atómica en Prisma
    result = await prisma.$transaction(async (tx) => {
      // A. Crear la Organización
      const newOrg = await tx.organization.create({
        data: {
          name: request.institutionName.trim(),
          code: orgCode,
          orgType: request.institutionType || 'UNIVERSITY',
          country: request.country || 'Perú',
          timezone: 'America/Lima',
          isActive: true,
        },
      });

      // B. Crear el Usuario Admin asociado
      const newUser = await tx.user.create({
        data: {
          username: tempUsername,
          email: targetEmail,
          password: hashedPassword,
          firstName: 'Administrador',
          lastName: request.institutionName.trim(),
          role: ROLES.ADMIN,
          organizationId: newOrg.id,
          scopeLevel: 'ORG',
          mustChangePassword: true,
          mustSetup2fa: true,
          isVerified: true,
          status: 'ACTIVE',
        },
      });

      // C. Actualizar estado de la solicitud
      const updatedRequest = await tx.organizationRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedById: actor.id,
        },
      });

      return { newOrg, newUser, updatedRequest, tempPassword, activationToken };
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.code === 'P2002') {
      throw ApiError.conflict('Conflicto de duplicidad al crear la organización o el usuario admin');
    }
    logger.error('Error en transacción de aprobación de solicitud', { requestId: id, error: error.message });
    throw ApiError.internal('Error interno al procesar la aprobación. Intente nuevamente.');
  }

  // 6. Notificación por correo electrónico (Fuera de la transacción)
  let emailSent = true;
  try {
    await sendAdminApprovalWithCredentials({
      email: targetEmail,
      institutionName: request.institutionName,
      username: result.newUser.username,
      tempPassword: result.tempPassword,
      token: result.activationToken,
    });

    logger.info('Solicitud aprobada y correo enviado con credenciales', {
      requestId: id,
      orgId: result.newOrg.id,
      userId: result.newUser.id,
    });
  } catch (emailErr) {
    emailSent = false;
    logger.error('Organización creada, pero falló el envío del correo de credenciales', {
      requestId: id,
      error: emailErr.message,
    });
  }

  return {
    success: true,
    message: emailSent
      ? 'Solicitud aprobada. Se creó la organización y se enviaron las credenciales por correo.'
      : 'Solicitud aprobada y organización creada, pero no se pudo enviar el correo de notificación.',
    emailSent,
    data: {
      organizationId: result.newOrg.id,
      userId: result.newUser.id,
      contactEmail: targetEmail,
      username: result.newUser.username,
    },
  };
};

/**
 * Rechazar una solicitud de organización con un motivo explícito.
 */
export const rejectRequest = async (id, actor = {}, rejectionReason) => {
  // 1. Validar permisos de Super Admin
  const isSuperUser =
    actor?.role === ROLES.SUPERADMIN || actor?.isSuperuser || actor?.isSuperAdmin;
  if (!isSuperUser) {
    throw ApiError.forbidden('Solo el Super Admin puede rechazar solicitudes de organización');
  }

  // 2. Validar existencia y estado de la solicitud
  const request = await organizationRepository.findRequestById(id);
  if (!request) {
    throw ApiError.notFound('Solicitud de organización no encontrada');
  }

  if (request.status !== 'PENDING') {
    throw ApiError.badRequest(`La solicitud ya se encuentra en estado ${request.status}`);
  }

  // 3. Actualizar estado y motivo en la base de datos
  const updatedRequest = await organizationRepository.updateRequest(id, {
    status: 'REJECTED',
    rejectionReason,
    reviewedById: actor.id,
    reviewedAt: new Date(),
  });

  logger.info('Solicitud de organización rechazada', {
    requestId: id,
    rejectedBy: actor.id,
  });

  return updatedRequest;
};

export default {
  createRequest,
  listRequests,
  getRequestById,
  approveRequest,
  rejectRequest,
};