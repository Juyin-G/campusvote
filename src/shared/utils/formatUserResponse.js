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
  organization_id: user.organizationId,
  is_verified: user.isVerified,
  is_active: user.isActive,
  is_staff: user.isStaff,
  is_superuser: user.isSuperuser,
  two_factor_enabled: user.twoFactorEnabled,
  must_change_password: user.mustChangePassword,
  last_login: user.lastLogin,
  date_joined: user.dateJoined,
});

export default formatUserResponse;
