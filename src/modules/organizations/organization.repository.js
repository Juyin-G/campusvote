import { prisma } from '../../database/prisma.js';

// SELECTS compartidos por dominio (snake_case por mapeo Prisma -> BD)
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
  name: true,
  start_date: true,
  end_date: true,
  is_active: true,
  created_at: true,
  updated_at: true,
};

// Helper para queries con filtros
const buildOrgWhere = ({ is_active, search } = {}) => {
  const where = {};
  if (is_active !== undefined) where.is_active = is_active;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
      { country: { contains: search, mode: 'insensitive' } },
    ];
  }
  return where;
};

// =================== ORGANIZATIONS ===================

export const findOrgById = (id) =>
  prisma.organizations.findUnique({
    where: { id },
    select: ORG_SELECT,
  });

export const findOrgByCode = (code) =>
  prisma.organizations.findUnique({
    where: { code },
    select: ORG_SELECT,
  });

export const listOrgs = ({ is_active, search, skip = 0, take = 10 } = {}) =>
  prisma.organizations.findMany({
    where: buildOrgWhere({ is_active, search }),
    select: ORG_SELECT,
    orderBy: { created_at: 'desc' },
    skip,
    take,
  });

export const countOrgs = ({ is_active, search } = {}) =>
  prisma.organizations.count({
    where: buildOrgWhere({ is_active, search }),
  });

export const createOrg = (data) =>
  prisma.organizations.create({
    data,
    select: ORG_SELECT,
  });

export const updateOrg = (id, data) =>
  prisma.organizations.update({
    where: { id },
    data,
    select: ORG_SELECT,
  });

export const setOrgActive = (id, is_active) =>
  prisma.organizations.update({
    where: { id },
    data: { is_active },
    select: ORG_SELECT,
  });

export const completeOrgOnboarding = (id) =>
  prisma.organizations.update({
    where: { id },
    data: {
      onboarding_completed: true,
      onboarding_completed_at: new Date(),
    },
    select: ORG_SELECT,
  });

export const deleteOrgById = (id) =>
  prisma.organizations.delete({
    where: { id },
    select: { id: true },
  });

// =================== ORGANIZATION REQUESTS ===================

export const findRequestById = (id) =>
  prisma.organization_requests.findUnique({
    where: { id },
    select: REQUEST_SELECT,
  });

export const listRequests = ({ status, skip = 0, take = 10 } = {}) =>
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

export const deleteRequestById = (id) =>
  prisma.organization_requests.delete({
    where: { id },
    select: { id: true },
  });

// Aprobacion de solicitud (delega en funcion SQL nativa con bloqueo pesimista)
export const approveOrganizationRequest = async (requestId, reviewerUserId) => {
  const result = await prisma.$queryRaw`
    SELECT approve_organization_request(${requestId}::uuid, ${reviewerUserId}::uuid, NULL) AS org_id
  `;
  return result[0]?.org_id ?? null;
};

// Rechazo de solicitud (misma funcion SQL con rejection_reason)
export const rejectOrganizationRequest = async (requestId, reviewerUserId, reason) => {
  const result = await prisma.$queryRaw`
    SELECT approve_organization_request(${requestId}::uuid, ${reviewerUserId}::uuid, ${reason}) AS org_id
  `;
  return result[0]?.org_id ?? null;
};

// =================== FACULTIES ===================

export const findFacultyById = (id) =>
  prisma.faculties.findUnique({
    where: { id },
    select: FACULTY_SELECT,
  });

export const findFacultyByCode = (code) =>
  prisma.faculties.findUnique({
    where: { code },
    select: FACULTY_SELECT,
  });

export const listFaculties = ({ skip = 0, take = 50 } = {}) =>
  prisma.faculties.findMany({
    select: FACULTY_SELECT,
    orderBy: { name: 'asc' },
    skip,
    take,
  });

export const createFaculty = (data) =>
  prisma.faculties.create({
    data,
    select: FACULTY_SELECT,
  });

export const updateFaculty = (id, data) =>
  prisma.faculties.update({
    where: { id },
    data,
    select: FACULTY_SELECT,
  });

export const deleteFaculty = (id) =>
  prisma.faculties.delete({
    where: { id },
    select: { id: true },
  });

// =================== PROGRAMS ===================

export const findProgramById = (id) =>
  prisma.programs.findUnique({
    where: { id },
    select: PROGRAM_SELECT,
  });

export const listPrograms = ({ faculty_id, skip = 0, take = 50 } = {}) =>
  prisma.programs.findMany({
    where: faculty_id ? { faculty_id } : undefined,
    select: PROGRAM_SELECT,
    orderBy: { name: 'asc' },
    skip,
    take,
  });

export const createProgram = (data) =>
  prisma.programs.create({
    data,
    select: PROGRAM_SELECT,
  });

export const updateProgram = (id, data) =>
  prisma.programs.update({
    where: { id },
    data,
    select: PROGRAM_SELECT,
  });

export const deleteProgram = (id) =>
  prisma.programs.delete({
    where: { id },
    select: { id: true },
  });

// =================== ACADEMIC PERIODS ===================

export const findPeriodById = (id) =>
  prisma.academic_periods.findUnique({
    where: { id },
    select: PERIOD_SELECT,
  });

export const listPeriods = ({ skip = 0, take = 50 } = {}) =>
  prisma.academic_periods.findMany({
    select: PERIOD_SELECT,
    orderBy: { start_date: 'desc' },
    skip,
    take,
  });

export const createPeriod = (data) =>
  prisma.academic_periods.create({
    data,
    select: PERIOD_SELECT,
  });

export const updatePeriod = (id, data) =>
  prisma.academic_periods.update({
    where: { id },
    data,
    select: PERIOD_SELECT,
  });

// Activa un periodo (la BD desactiva los demas automaticamente por constraint)
export const setActivePeriod = async (id) => {
  await prisma.$queryRaw`UPDATE academic_periods SET is_active = FALSE WHERE is_active = TRUE`;
  return prisma.academic_periods.update({
    where: { id },
    data: { is_active: true },
    select: PERIOD_SELECT,
  });
};

export const deletePeriod = (id) =>
  prisma.academic_periods.delete({
    where: { id },
    select: { id: true },
  });

export default {
  // organizations
  findOrgById,
  findOrgByCode,
  listOrgs,
  countOrgs,
  createOrg,
  updateOrg,
  setOrgActive,
  completeOrgOnboarding,
  deleteOrgById,
  // requests
  findRequestById,
  listRequests,
  countRequests,
  createRequest,
  updateRequest,
  deleteRequestById,
  approveOrganizationRequest,
  rejectOrganizationRequest,
  // faculties
  findFacultyById,
  findFacultyByCode,
  listFaculties,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  // programs
  findProgramById,
  listPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
  // periods
  findPeriodById,
  listPeriods,
  createPeriod,
  updatePeriod,
  setActivePeriod,
  deletePeriod,
};
