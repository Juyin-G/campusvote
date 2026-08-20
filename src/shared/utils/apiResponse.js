/**
 * @file apiResponse.js
 * @description Utilidad para estandarizar las respuestas de la API CampusVote
 * @module shared/utils/apiResponse
 */

/**
 * Respuesta exitosa estándar
 */
export const successResponse = ({
  data = null,
  message = 'Success',
  meta = {},
  statusCode = 200,
}) => {
  return {
    statusCode,
    body: {
      success: true,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    },
  };
};

/**
 * Respuesta de creación (201)
 */
export const createdResponse = ({
  data = null,
  message = 'Created successfully',
}) => {
  return successResponse({
    data,
    message,
    statusCode: 201,
  });
};

/**
 * Respuesta de error estándar 
 */
export const errorResponse = ({
  message = 'An error occurred',
  statusCode = 500,
  code = 'INTERNAL_SERVER_ERROR',
  details = null,
}) => {
  return {
    statusCode,
    body: {
      success: false,
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
      },
    },
  };
};

/**
 * Respuesta con paginación
 */
export const paginatedResponse = ({
  data = [],
  message = 'Success',
  pagination = {},
}) => {
  const { page = 1, limit = 10, total = 0 } = pagination;
  const totalPages = Math.ceil(total / limit) || 0;

  return successResponse({
    data,
    message,
    meta: {
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(total),
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    },
  });
};

/**
 * Respuesta de actualización
 */
export const updatedResponse = ({
  data = null,
  message = 'Updated successfully',
}) => {
  return successResponse({
    data,
    message,
    statusCode: 200,
  });
};

/**
 * Respuesta de eliminación
 */
export const deletedResponse = ({
  message = 'Deleted successfully',
}) => {
  return successResponse({
    message,
    statusCode: 200,
  });
};

// HELPERS PARA EXPRESS (Directos al `res`)

export const sendResponse = (res, response) => {
  const { statusCode, body } = response;
  return res.status(statusCode).json(body);
};

export const sendSuccess = (res, data, message = 'Success', meta = {}, statusCode = 200) => {
  return sendResponse(res, successResponse({ data, message, meta, statusCode }));
};

export const sendCreated = (res, data, message = 'Created successfully') => {
  return sendResponse(res, createdResponse({ data, message }));
};

export const sendPaginated = (res, data, pagination, message = 'Success') => {
  return sendResponse(res, paginatedResponse({ data, pagination, message }));
};

export const sendUpdated = (res, data, message = 'Updated successfully') => {
  return sendResponse(res, updatedResponse({ data, message }));
};

export const sendDeleted = (res, message = 'Deleted successfully') => {
  return sendResponse(res, deletedResponse({ message }));
};

export const sendError = (res, message = 'An error occurred', statusCode = 500, details = null, code = 'INTERNAL_SERVER_ERROR') => {
  return sendResponse(res, errorResponse({ message, statusCode, details, code }));
};