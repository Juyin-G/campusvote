/**
 * Roles de usuario del sistema
 * Basados en el ENUM user_role de la base de datos
 */
export const ROLES = Object.freeze({
  STUDENT: 'STUDENT',
  TEACHER: 'TEACHER',
  ADMIN: 'ADMIN',
  ELECTORAL_COMMISSION: 'ELECTORAL_COMMISSION',
  OBSERVER: 'OBSERVER',
});

/**
 * Array de todos los roles disponibles
 */
export const ALL_ROLES = Object.values(ROLES);

/**
 * Roles que tienen acceso administrativo
 */
export const ADMIN_ROLES = [
  ROLES.ADMIN,
  ROLES.ELECTORAL_COMMISSION,
];

/**
 * Roles que pueden participar en elecciones
 */
export const ELECTORAL_ROLES = [
  ROLES.STUDENT,
  ROLES.TEACHER,
  ROLES.ADMIN,
  ROLES.ELECTORAL_COMMISSION,
];

/**
 * Valida si un rol es válido
 * @param {string} role - Rol a validar
 * @returns {boolean}
 */
export const isValidRole = (role) => ALL_ROLES.includes(role);

/**
 * Verifica si un rol tiene permisos administrativos
 * @param {string} role - Rol a verificar
 * @returns {boolean}
 */
export const isAdminRole = (role) => ADMIN_ROLES.includes(role);

/**
 * Verifica si un rol puede participar en procesos electorales
 * @param {string} role - Rol a verificar
 * @returns {boolean}
 */
export const isElectoralRole = (role) => ELECTORAL_ROLES.includes(role);

export default {
  ROLES,
  ALL_ROLES,
  ADMIN_ROLES,
  ELECTORAL_ROLES,
  isValidRole,
  isAdminRole,
  isElectoralRole,
};