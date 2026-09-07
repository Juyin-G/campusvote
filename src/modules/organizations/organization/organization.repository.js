// src/modules/organizations/organization.repository.js

import { prisma } from '../../../database/prisma.js';

const ORG_SELECT = {
  id: true,
  name: true,
  code: true,
  orgType: true,          // No 'org_type'
  isActive: true,         // No 'is_active'
  logo: true,
  primaryColor: true,     // No 'primary_color'
  secondaryColor: true,   // No 'secondary_color'
  country: true,
  timezone: true,
  onboardingCompleted: true,      // No 'onboarding_completed'
  onboardingCompletedAt: true,    // No 'onboarding_completed_at'
  allowedEmailDomains: true,      // No 'allowed_email_domains'
  memberLimit: true,              // No 'member_limit'
  createdAt: true,        // No 'created_at'
  updatedAt: true,        // No 'updated_at'
};

const REQUEST_SELECT = {
  id: true,
  institutionName: true,  // No 'institution_name'
  institutionType: true,  // No 'institution_type'
  country: true,
  estimatedMembers: true, // No 'estimated_members'
  contactEmail: true,     // No 'contact_email'
  contactPhone: true,     // No 'contact_phone'
  message: true,
  status: true,
  reviewedById: true,     // No 'reviewed_by_id'
  reviewedAt: true,       // No 'reviewed_at'
  rejectionReason: true,  // No 'rejection_reason'
  createdAt: true,
  updatedAt: true,
};

const buildOrgWhere = ({ isActive, search } = {}) => {
  const where = {};
  
  // isActive ya viene como booleano desde el service, así que lo asignamos directo
  if (isActive !== undefined) {
    where.isActive = isActive;
  }
  
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
      { country: { contains: search, mode: 'insensitive' } },
    ];
  }
  return where;
};

// --- ORGANIZATIONS ---
//  Modelo en singular: prisma.organization
export const findOrgById = (id) => 
  prisma.organization.findUnique({ where: { id }, select: ORG_SELECT });

export const findOrgByCode = (code) => 
  prisma.organization.findUnique({ where: { code }, select: ORG_SELECT });

export const listOrgs = ({ isActive, search, skip = 0, take = 10 } = {}) => 
  prisma.organization.findMany({ 
    where: buildOrgWhere({ isActive, search }), 
    select: ORG_SELECT, 
    orderBy: { createdAt: 'desc' }, 
    skip, 
    take 
  });

export const countOrgs = ({ isActive, search } = {}) => 
  prisma.organization.count({ where: buildOrgWhere({ isActive, search }) });

export const countOrganizationMembers = (organizationId) =>
  prisma.user.count({
    where: {
      organizationId,
      role: { not: 'SUPERADMIN' },
      status: { not: 'DELETED' },
    },
  });

export const createOrg = (data) => 
  prisma.organization.create({ data, select: ORG_SELECT });

export const updateOrg = (id, data) => 
  prisma.organization.update({ where: { id }, data, select: ORG_SELECT });

export const setOrgActive = (id, isActive) => 
  prisma.organization.update({ where: { id }, data: { isActive }, select: ORG_SELECT });

export const completeOrgOnboarding = (id) => 
  prisma.organization.update({ 
    where: { id }, 
    data: { onboardingCompleted: true, onboardingCompletedAt: new Date() }, 
    select: ORG_SELECT 
  });

export const deleteOrgById = (id) => 
  prisma.organization.delete({ where: { id }, select: { id: true } });


// --- ORGANIZATION REQUESTS ---
export const findRequestById = (id) => 
  prisma.organizationRequest.findUnique({ where: { id }, select: REQUEST_SELECT });

export const listRequests = ({ status, skip = 0, take = 10 } = {}) => 
  prisma.organizationRequest.findMany({ 
    where: status ? { status } : undefined, 
    select: REQUEST_SELECT, 
    orderBy: { createdAt: 'desc' }, 
    skip, 
    take 
  });

export const countRequests = ({ status } = {}) => 
  prisma.organizationRequest.count({ where: status ? { status } : undefined });

export const createRequest = (data) => 
  prisma.organizationRequest.create({ data, select: REQUEST_SELECT });

export const updateRequest = (id, data) => 
  prisma.organizationRequest.update({ where: { id }, data, select: REQUEST_SELECT });

export const deleteRequestById = (id) => 
  prisma.organizationRequest.delete({ where: { id }, select: { id: true } });

// Ejecución de la función SQL nativa
export const approveOrganizationRequest = async (requestId, reviewerUserId, rejectionReason = null) => {
  const result = await prisma.$queryRaw`
    SELECT approve_organization_request(
      ${requestId}::uuid, 
      ${reviewerUserId}::uuid, 
      ${rejectionReason}::text
    ) AS new_org_id
  `;
  
  const newOrgId = result[0]?.new_org_id ?? null;
  if (!newOrgId) return null; // Retorna null si fue rechazada
  
  return findOrgById(newOrgId);
};

export const rejectOrganizationRequest = async (requestId, reviewerUserId, reason) => {
  return prisma.organizationRequest.update({
    where: { id: requestId },
    data: {
      status: 'REJECTED',
      reviewedById: reviewerUserId,
      reviewedAt: new Date(),
      rejectionReason: reason,
    },
    select: REQUEST_SELECT,
  });
};

export default {
  findOrgById,
  findOrgByCode,
  listOrgs,
  countOrgs,
  countOrganizationMembers,
  createOrg,
  updateOrg,
  setOrgActive,
  completeOrgOnboarding,
  deleteOrgById,
  findRequestById,
  listRequests,
  countRequests,
  createRequest,
  updateRequest,
  deleteRequestById,
  approveOrganizationRequest,
  rejectOrganizationRequest,
};