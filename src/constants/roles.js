/**
 * Roles de usuario del sistema
 * Basados en el ENUM user_role de la base de datos
 *
 * Regla: no se usan roles derivados como ADMIN_ORG / ADMIN_REGION /
 * ADMIN_SITE. El alcance administrativo se modela con `scopeLevel`,
 * `regionId` y `user_site_assignments`. Ver src/services/adminScope.service.js.
 */
export const ROLES = Object.freeze({
  STUDENT: 'STUDENT',
  TEACHER: 'TEACHER',
  ADMIN: 'ADMIN',
  SUPERADMIN: 'SUPERADMIN',
  JURY: 'JURY',
});

/**
 * Array de todos los roles disponibles
 */
export const ALL_ROLES = Object.values(ROLES);

/**
 * Roles con capacidad administrativa sobre la organización.
 * Incluyen SUPERADMIN (plataforma) y ADMIN (tenant con scope).
 */
export const ADMIN_ROLES = [
  ROLES.SUPERADMIN,
  ROLES.ADMIN,
];

/**
 * Valida si un rol es válido
 * @param {string} role - Rol a validar
 * @returns {boolean}
 */
export const isValidRole = (role) => ALL_ROLES.includes(role);

/**
 * Verifica si un rol tiene permisos administrativos (incluye plataforma).
 * @param {string} role - Rol a verificar
 * @returns {boolean}
 */
export const isAdminRole = (role) => ADMIN_ROLES.includes(role);

export default {
  ROLES,
  ALL_ROLES,
  ADMIN_ROLES,
  isValidRole,
  isAdminRole,
};
