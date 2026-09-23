/**
 * Índice centralizado de constantes del sistema CAMPUSVOTE
 */

export { default as HTTP_STATUS } from './httpStatus.js';
export { default as MESSAGES } from './messages.js';

export {
  default as ROLES,
  ROLES as ROLES_ENUM,
  ALL_ROLES,
  ADMIN_ROLES,
  isValidRole,
  isAdminRole,
} from './roles.js';

/**
 * Reemplaza variables en los mensajes del sistema (ej: "{minutes}" -> "15").
 *
 * @param {string} template - Cadena de texto con marcadores de posición.
 * @param {Record<string, string|number>} params - Objeto con valores a sustituir.
 * @returns {string} Mensaje procesado.
 */
export const formatMessage = (template, params = {}) => {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return params[key] !== undefined ? params[key] : match;
  });
};