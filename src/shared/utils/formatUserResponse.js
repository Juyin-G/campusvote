/**
 * Formato público de usuario (snake_case) — usado en auth y users.
 */
export const formatUserResponse = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  first_name: user.firstName,
  last_name: user.lastName,
  role: user.role,
  institutional_id: user.institutionalId,
  document_type: user.documentType ?? null,
  document_number: user.documentNumber ?? null,
  phone_number: user.phoneNumber ?? null,
  organization_id: user.organizationId,
  scope_level: user.scopeLevel ?? null,
  region_id: user.regionId ?? null,
  site_ids: (user.siteAssignments || []).map((site) => site.siteId),
  is_verified: user.isVerified,
  is_active: user.status === 'ACTIVE',
  status: user.status,
  is_staff: user.isStaff,
  is_superuser: user.isSuperuser,
  two_factor_enabled: user.twoFactorEnabled,
  must_change_password: user.mustChangePassword,
  must_setup_2fa: user.mustSetup2fa ?? false,
  last_login: user.lastLogin,
  date_joined: user.dateJoined,
});

export default formatUserResponse;
