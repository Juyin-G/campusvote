import logger from '../../config/logger.js';
import * as authService from './auth.service.js';
import { assertLoginBody } from './auth.schema.js';

export const login = async (req, res) => {
  try {
    assertLoginBody(req.body);

    const result =
      await authService.login(req.body);

    logger.info(
      `User login processed successfully: ${req.body.email}`,
    );

    return res.status(200).json({
      success: true,
      message: result.requiresTotp
        ? 'Se requiere verificación TOTP'
        : 'Login exitoso',
      data: result,
    });
  } catch (error) {
    logger.error(
      `Login error for ${req.body?.email}:`,
      error,
    );

    const statusCode =
      error.statusCode || 500;

    const errorCode =
      statusCode === 423
        ? 'ACCOUNT_LOCKED'
        : statusCode === 401
          ? 'INVALID_CREDENTIALS'
          : statusCode === 400
            ? 'VALIDATION_ERROR'
            : 'LOGIN_ERROR';

    return res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message:
          error.message ||
          'Error al iniciar sesión',
      },
    });
  }
};

export const logout = async (req, res) => {
  try {
    await authService.logout({
      userId: req.user.userId,
      email: req.user.email,
    });

    logger.info(
      `User logged out successfully: ${req.user.email}`,
    );

    return res.status(200).json({
      success: true,
      message: 'Logout exitoso',
      data: {
        loggedOut: true,
      },
    });
  } catch (error) {
    logger.error(
      `Logout error for ${req.user?.email}:`,
      error,
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        error: {
          code: 'LOGOUT_ERROR',
          message:
            error.message ||
            'Error al cerrar sesión',
        },
      });
  }
};

export const setupTotp = async (req, res) => {
  try {
    const result =
      await authService.setupTotp(
        req.user.userId,
      );

    return res.status(200).json({
      success: true,
      message: 'Configuración TOTP generada',
      data: result,
    });
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        error: {
          code: 'TOTP_SETUP_ERROR',
          message: error.message,
        },
      });
  }
};

export const verifyTotp = async (req, res) => {
  try {
    const result =
      await authService.verifyTotp(
        req.user.userId,
        req.body.token,
      );

    return res.status(200).json({
      success: true,
      message:
        'TOTP verificado correctamente',
      data: result,
    });
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        error: {
          code: 'TOTP_VERIFY_ERROR',
          message: error.message,
        },
      });
  }
};

export const verifyLoginTotp = async (
  req,
  res,
) => {
  try {
    const result =
      await authService.verifyLoginTotp(
        req.user.userId,
        req.body.token,
      );

    return res.status(200).json({
      success: true,
      message:
        'Autenticación TOTP completada',
      data: result,
    });
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        error: {
          code: 'TOTP_LOGIN_ERROR',
          message: error.message,
        },
      });
  }
};

export default {
  login,
  logout,
  setupTotp,
  verifyTotp,
  verifyLoginTotp,
};