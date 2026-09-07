// src/shared/utils/emailDomain.js
// Utilidades para validar el dominio de un correo contra la lista de dominios
// permitidos de una organización (p. ej. jurados con correos corporativos).

/**
 * Extrae el dominio de un correo (la parte después de la "@", en minúsculas).
 * @param {string} email
 * @returns {string}
 */
export const extractDomain = (email) => {
  if (!email || !email.includes('@')) return '';
  return email.split('@').pop().trim().toLowerCase();
};

/**
 * Normaliza un dominio (quita "@" inicial, minúsculas, sin espacios).
 * @param {string} domain
 * @returns {string}
 */
export const normalizeDomain = (domain) =>
  domain?.trim().replace(/^@/, '').toLowerCase() || '';

/**
 * Valida que el dominio de un email esté dentro de la lista de dominios
 * permitidos de la organización. Si la lista está vacía, se rechaza el correo
 * (porque el admin debe configurar los dominios antes de registrar jurados).
 * @param {string} email
 * @param {string[]} allowedDomains
 * @returns {boolean}
 */
export const isDomainAllowed = (email, allowedDomains = []) => {
  const emailDomain = extractDomain(email);
  if (!emailDomain) return false;

  const normalized = (allowedDomains || []).map(normalizeDomain).filter(Boolean);

  if (normalized.length === 0) return false;

  return normalized.some((domain) => emailDomain === domain);
};

export default {
  extractDomain,
  normalizeDomain,
  isDomainAllowed,
};
