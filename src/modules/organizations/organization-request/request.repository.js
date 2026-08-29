// src/modules/organizations/organization-request/request.repository.js

import { prisma } from '../../../database/prisma.js';

const REQUEST_SELECT = {
  id: true,
  institutionName: true,    // No 'institution_name'
  institutionType: true,    // No 'institution_type'
  country: true,
  estimatedMembers: true,   // No 'estimated_members'
  contactEmail: true,       // No 'contact_email'
  contactPhone: true,       // No 'contact_phone'
  message: true,
  status: true,
  reviewedById: true,       // No 'reviewed_by_id'
  reviewedAt: true,         // No 'reviewed_at'
  rejectionReason: true,    // No 'rejection_reason'
  createdAt: true,          // No 'created_at'
  updatedAt: true,          // No 'updated_at'
};

export const findRequestById = (id) =>
  prisma.organizationRequest.findUnique({ // ⚠️ Modelo en singular
    where: { id },
    select: REQUEST_SELECT,
  });

export const listRequests = ({ status, skip = 0, take = 10 } = {}) =>
  prisma.organizationRequest.findMany({
    where: status ? { status } : undefined,
    select: REQUEST_SELECT,
    orderBy: { createdAt: 'desc' }, // ⚠️ camelCase
    skip,
    take,
  });

export const countRequests = ({ status } = {}) =>
  prisma.organizationRequest.count({
    where: status ? { status } : undefined,
  });

export const createRequest = (data) =>
  prisma.organizationRequest.create({
    data,
    select: REQUEST_SELECT,
  });

export const updateRequest = (id, data) =>
  prisma.organizationRequest.update({
    where: { id },
    data,
    select: REQUEST_SELECT,
  });

export default {
  findRequestById,
  listRequests,
  countRequests,
  createRequest,
  updateRequest,
};