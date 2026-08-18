import logger from '../../config/logger.js';
import * as authService from './auth.service.js';

export const login = async (req, res) => {
  try {
    const result = await authService.login(req.body);

    logger.info(`User logged in successfully: ${req.body.email}`);

    return res.status(200).json({
      success: true,
      message: 'Login exitoso',
      data: result,
    });
  } catch (error) {
    logger.error(`Login error for ${req.body?.email}:`, error);

    const statusCode = error.statusCode || 500;
    const errorCode =
      statusCode === 423
        ? 'ACCOUNT_LOCKED'
        : statusCode === 401
        ? 'INVALID_CREDENTIALS'
        : 'LOGIN_ERROR';

    return res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: error.message || 'Error al iniciar sesión',
      },
    });
  }
};

export default {
  login,
};