const { prisma } = require('../../database/prisma');

// SELECTS compartidos por dominio
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

const FACULTY_SELECT = {
  id: true,
  organization_id: true,
  name: true,
  code: true,
  created_at: true,
  updated_at: true,
};

const PROGRAM_SELECT = {
  id: true,
  faculty_id: true,
  name: true,
  code: true,
  created_at: true,
  updated_at: true,
};

const PERIOD_SELECT = {
  id: true,
  organization_id: true,
  name: true,
  start_date: true,
  end_date: true,
  is_active: true,
  created_at: true,
  updated_at: true,
};

// Helper para queries con filtros y casteos correctos
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

const findOrgById = (id) =>
  prisma.organizations.findUnique({
    where: { id },
    select: ORG_SELECT,
  });

const findOrgByCode = (code) =>
  prisma.organizations.findUnique({
    where: { code },
    select: ORG_SELECT,
  });

const listOrgs = ({ is_active, search, skip = 0, take = 10 } = {}) =>
  prisma.organizations.findMany({
    where: buildOrgWhere({ is_active, search }),
    select: ORG_SELECT,
    orderBy: { created_at: 'desc' },
    skip,
    take,
  });

const countOrgs = ({ is_active, search } = {}) =>
  prisma.organizations.count({
    where: buildOrgWhere({ is_active, search }),
  });

const createOrg = (data) =>
  prisma.organizations.create({
    data,
    select: ORG_SELECT,
  });

const updateOrg = (id, data) =>
  prisma.organizations.update({
    where: { id },
    data,
    select: ORG_SELECT,
  });

const setOrgActive = (id, is_active) =>
  prisma.organizations.update({
    where: { id },
    data: { is_active },
    select: ORG_SELECT,
  });

const completeOrgOnboarding = (id) =>
  prisma.organizations.update({
    where: { id },
    data: {
      onboarding_completed: true,
      onboarding_completed_at: new Date(),
    },
    select: ORG_SELECT,
  });

const deleteOrgById = (id) =>
  prisma.organizations.delete({
    where: { id },
    select: { id: true },
  });

// --- ORGANIZATION REQUESTS ---

const findRequestById = (id) =>
  prisma.organization_requests.findUnique({
    where: { id },
    select: REQUEST_SELECT,
  });

const listRequests = ({ status, skip = 0, take = 10 } = {}) =>
  prisma.organization_requests.findMany({
    where: status ? { status } : undefined,
    select: REQUEST_SELECT,
    orderBy: { created_at: 'desc' },
    skip,
    take,
  });

const countRequests = ({ status } = {}) =>
  prisma.organization_requests.count({
    where: status ? { status } : undefined,
  });

const createRequest = (data) =>
  prisma.organization_requests.create({
    data,
    select: REQUEST_SELECT,
  });

const updateRequest = (id, data) =>
  prisma.organization_requests.update({
    where: { id },
    data,
    select: REQUEST_SELECT,
  });

const deleteRequestById = (id) =>
  prisma.organization_requests.delete({
    where: { id },
    select: { id: true },
  });

const approveOrganizationRequest = async (requestId, reviewerUserId) => {
  const result = await prisma.$queryRaw`
    SELECT approve_organization_request(${requestId}::uuid, ${reviewerUserId}::uuid) AS org_id
  `;
  const newOrgId = result[0]?.org_id ?? null;
  if (!newOrgId) return null;

  return findOrgById(newOrgId);
};

const rejectOrganizationRequest = async (requestId, reviewerUserId, reason) => {
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

// --- FACULTIES ---

const findFacultyById = (id) =>
  prisma.faculties.findUnique({
    where: { id },
    select: FACULTY_SELECT,
  });

const findFacultyByCode = (code) =>
  prisma.faculties.findUnique({
    where: { code },
    select: FACULTY_SELECT,
  });

const listFaculties = ({ organization_id, skip = 0, take = 50 } = {}) =>
  prisma.faculties.findMany({
    where: organization_id ? { organization_id } : undefined,
    select: FACULTY_SELECT,
    orderBy: { name: 'asc' },
    skip,
    take,
  });

const createFaculty = (data) =>
  prisma.faculties.create({
    data,
    select: FACULTY_SELECT,
  });

const updateFaculty = (id, data) =>
  prisma.faculties.update({
    where: { id },
    data,
    select: FACULTY_SELECT,
  });

const deleteFaculty = (id) =>
  prisma.faculties.delete({
    where: { id },
    select: { id: true },
  });

// --- PROGRAMS ---

const findProgramById = (id) =>
  prisma.programs.findUnique({
    where: { id },
    select: PROGRAM_SELECT,
  });

const listPrograms = ({ faculty_id, skip = 0, take = 50 } = {}) =>
  prisma.programs.findMany({
    where: faculty_id ? { faculty_id } : undefined,
    select: PROGRAM_SELECT,
    orderBy: { name: 'asc' },
    skip,
    take,
  });

const createProgram = (data) =>
  prisma.programs.create({
    data,
    select: PROGRAM_SELECT,
  });

const updateProgram = (id, data) =>
  prisma.programs.update({
    where: { id },
    data,
    select: PROGRAM_SELECT,
  });

const deleteProgram = (id) =>
  prisma.programs.delete({
    where: { id },
    select: { id: true },
  });

// --- ACADEMIC PERIODS ---

const findPeriodById = (id) =>
  prisma.academic_periods.findUnique({
    where: { id },
    select: PERIOD_SELECT,
  });

const listPeriods = ({ organization_id, skip = 0, take = 50 } = {}) =>
  prisma.academic_periods.findMany({
    where: organization_id ? { organization_id } : undefined,
    select: PERIOD_SELECT,
    orderBy: { start_date: 'desc' },
    skip,
    take,
  });

const createPeriod = (data) =>
  prisma.academic_periods.create({
    data,
    select: PERIOD_SELECT,
  });

const updatePeriod = (id, data) =>
  prisma.academic_periods.update({
    where: { id },
    data,
    select: PERIOD_SELECT,
  });

const setActivePeriod = async (id, organizationId) => {
  return prisma.$transaction(async (tx) => {
    if (organizationId) {
      await tx.academic_periods.updateMany({
        where: { organization_id: organizationId, is_active: true },
        data: { is_active: false },
      });
    }

    return tx.academic_periods.update({
      where: { id },
      data: { is_active: true },
      select: PERIOD_SELECT,
    });
  });
};

const deletePeriod = (id) =>
  prisma.academic_periods.delete({
    where: { id },
    select: { id: true },
  });

module.exports = {
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
  rejectOrganizationRequest,
  findFacultyById,
  findFacultyByCode,
  listFaculties,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  findProgramById,
  listPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
  findPeriodById,
  listPeriods,
  createPeriod,
  updatePeriod,
  setActivePeriod,
  deletePeriod,
};