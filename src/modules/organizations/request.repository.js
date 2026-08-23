// src/modules/organizations/request.repository.js

import { prisma } from '../../database/prisma.js';

const REQUEST_SELECT = {
  id: true,
  institution_name: true,
  institution_type: true,
  country: true,
  estimated_members: true,
  contact_email: true,
  contact_phone: true,
  message: true,
  status: true,
  reviewed_by: true,
  reviewed_at: true,
  rejection_reason: true,
  created_at: true,
  updated_at: true,
};

export const findRequestById = (id) =>
  prisma.organization_requests.findUnique({
    where: { id },
    select: REQUEST_SELECT,
  });

export const listRequests = ({
  status,
  skip = 0,
  take = 10,
} = {}) =>
  prisma.organization_requests.findMany({
    where: status ? { status } : undefined,
    select: REQUEST_SELECT,
    orderBy: { created_at: 'desc' },
    skip,
    take,
  });

export const countRequests = ({ status } = {}) =>
  prisma.organization_requests.count({
    where: status ? { status } : undefined,
  });

export const createRequest = (data) =>
  prisma.organization_requests.create({
    data,
    select: REQUEST_SELECT,
  });

export const updateRequest = (id, data) =>
  prisma.organization_requests.update({
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