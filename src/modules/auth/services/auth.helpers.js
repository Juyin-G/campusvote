import jwt from 'jsonwebtoken';
import env from '../../../config/env.js';
import { formatUserResponse } from '../../../shared/utils/formatUserResponse.js';

export { formatUserResponse };

export const generateJwt = (user) =>
  jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      isSuperuser: user.isSuperuser,
      isStaff: user.isStaff,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN || '24h' },
  );

export default {
  generateJwt,
  formatUserResponse,
};
