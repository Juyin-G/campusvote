import { prisma } from '../../database/prisma.js';

const ORG_SELECT = {
  id: true,
  name: true,
  code: true,
  org_type: true,
  is_active: true,
  logo: true,
  primary_color: true,
  secondary_color: true,
  country: true,
  timezone: true,
  onboarding_completed: true,
  onboarding_completed_at: true,
  created_at: true,
  updated_at: true,
};

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

const buildOrgWhere = ({ is_active, search } = {}) => {
  const where = {};
  if (is_active !== undefined) {
    where.is_active = is_active === 'true' || is_active === true;
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
export const findOrgById = (id) => prisma.organizations.findUnique({ where: { id }, select: ORG_SELECT });
export const findOrgByCode = (code) => prisma.organizations.findUnique({ where: { code }, select: ORG_SELECT });
export const listOrgs = ({ is_active, search, skip = 0, take = 10 } = {}) => prisma.organizations.findMany({ where: buildOrgWhere({ is_active, search }), select: ORG_SELECT, orderBy: { created_at: 'desc' }, skip, take });
export const countOrgs = ({ is_active, search } = {}) => prisma.organizations.count({ where: buildOrgWhere({ is_active, search }) });
export const createOrg = (data) => prisma.organizations.create({ data, select: ORG_SELECT });
export const updateOrg = (id, data) => prisma.organizations.update({ where: { id }, data, select: ORG_SELECT });
export const setOrgActive = (id, is_active) => prisma.organizations.update({ where: { id }, data: { is_active }, select: ORG_SELECT });
export const completeOrgOnboarding = (id) => prisma.organizations.update({ where: { id }, data: { onboarding_completed: true, onboarding_completed_at: new Date() }, select: ORG_SELECT });
export const deleteOrgById = (id) => prisma.organizations.delete({ where: { id }, select: { id: true } });

// --- ORGANIZATION REQUESTS ---
export const findRequestById = (id) => prisma.organization_requests.findUnique({ where: { id }, select: REQUEST_SELECT });
export const listRequests = ({ status, skip = 0, take = 10 } = {}) => prisma.organization_requests.findMany({ where: status ? { status } : undefined, select: REQUEST_SELECT, orderBy: { created_at: 'desc' }, skip, take });
export const countRequests = ({ status } = {}) => prisma.organization_requests.count({ where: status ? { status } : undefined });
export const createRequest = (data) => prisma.organization_requests.create({ data, select: REQUEST_SELECT });
export const updateRequest = (id, data) => prisma.organization_requests.update({ where: { id }, data, select: REQUEST_SELECT });
export const deleteRequestById = (id) => prisma.organization_requests.delete({ where: { id }, select: { id: true } });
export const approveOrganizationRequest = async (requestId, reviewerUserId) => {
  const result = await prisma.$queryRaw`
    SELECT approve_organization_request(${requestId}::uuid, ${reviewerUserId}::uuid) AS org_id
  `;
  const newOrgId = result[0]?.org_id ?? null;
  if (!newOrgId) return null;
  return findOrgById(newOrgId);
};
export const rejectOrganizationRequest = async (requestId, reviewerUserId, reason) => {
  return prisma.organization_requests.update({
    where: { id: requestId },
    data: {
      status: 'REJECTED',
      reviewed_by: reviewerUserId,
      reviewed_at: new Date(),
      rejection_reason: reason,
    },
    select: REQUEST_SELECT,
  });
};

export default {
  findOrgById,
  findOrgByCode,
  listOrgs,
  countOrgs,
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
  rejectOrganizationRequest
};