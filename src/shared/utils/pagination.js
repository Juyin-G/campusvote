/**
 * @file pagination.js
 * @description Utilidad de paginación reutilizable para toda la API
 * @module shared/utils/pagination
 */

// ═══════════════════════════════════════════════════════════
// CONSTANTES DE PAGINACIÓN
// ═══════════════════════════════════════════════════════════

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MIN_LIMIT = 1;

// ═══════════════════════════════════════════════════════════
// PARSEO DE PARÁMETROS
// ═══════════════════════════════════════════════════════════

/**
 * Parsea y valida los parámetros de paginación desde la query string
 * 
 * @param {Object} query - Query string de Express (req.query)
 * @param {Object} [options] - Opciones de configuración
 * @param {number} [options.defaultPage=1] - Página por defecto
 * @param {number} [options.defaultLimit=20] - Límite por defecto
 * @param {number} [options.maxLimit=100] - Límite máximo permitido
 * @returns {Object} Parámetros de paginación validados
 */
export const parsePagination = (query = {}, options = {}) => {
  const {
    defaultPage = DEFAULT_PAGE,
    defaultLimit = DEFAULT_LIMIT,
    maxLimit = MAX_LIMIT,
  } = options;

  let page = parseInt(query.page, 10);
  if (isNaN(page) || page < 1) {
    page = defaultPage;
  }

  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < MIN_LIMIT) {
    limit = defaultLimit;
  }

  if (limit > maxLimit) {
    limit = maxLimit;
  }

  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset,
  };
};

// ═══════════════════════════════════════════════════════════
// RESPUESTA DE PAGINACIÓN
// ═══════════════════════════════════════════════════════════

/**
 * Formatea la respuesta de paginación para la API
 * 
 * @param {Object} params - Parámetros de paginación
 * @param {Array} params.data - Array de datos paginados
 * @param {number} params.total - Total de registros
 * @param {number} params.page - Página actual
 * @param {number} params.limit - Límite por página
 * @returns {Object} Respuesta formateada con metadatos de paginación
 */
export const formatPagination = ({ data = [], total = 0, page = 1, limit = DEFAULT_LIMIT } = {}) => {
  const totalPages = Math.ceil(total / limit) || 0;

  return {
    data,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(total),
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
};

// ═══════════════════════════════════════════════════════════
// HELPERS PARA BASE DE DATOS
// ═══════════════════════════════════════════════════════════

/**
 * Genera el objeto de paginación para Prisma
 */
export const prismaPagination = ({ page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = {}) => {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
};

/**
 * Genera la cláusula LIMIT/OFFSET para SQL nativo
 */
export const sqlPagination = ({ limit = DEFAULT_LIMIT, offset = 0 } = {}) => {
  return { limit, offset };
};

/**
 * Genera parámetros de paginación para consultas con COUNT
 */
export const paginationForCount = ({ page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = {}) => {
  return {
    limit,
    offset: (page - 1) * limit,
    page,
  };
};

// ═══════════════════════════════════════════════════════════
// VALIDACIÓN
// ═══════════════════════════════════════════════════════════

/**
 * Valida que los parámetros de paginación sean válidos
 */
export const isValidPagination = ({ page, limit } = {}) => {
  return (
    Number.isInteger(page) &&
    Number.isInteger(limit) &&
    page >= 1 &&
    limit >= MIN_LIMIT &&
    limit <= MAX_LIMIT
  );
};

// EXPORTS

export default {
  parsePagination,
  formatPagination,
  prismaPagination,
  sqlPagination,
  paginationForCount,
  isValidPagination,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
};