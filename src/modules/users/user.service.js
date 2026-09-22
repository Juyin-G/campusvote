// src/modules/users/user.service.js
// Orquestador del módulo de usuarios. Re-exporta la API pública desde los
// sub-servicios (read, create, provision, update, profile) + helpers puros.

export { listUsers, getMe, getUserById } from './user.read.service.js';
export { createUser, createUsersBulk } from './user.create.service.js';
export { provisionAdmin, provisionExistingAdmin } from './user.provision.service.js';
export {
  updateUser,
  setActiveStatus,
  unlockUser,
  updateUserRole,
} from './user.update.service.js';
export { updateMyProfile, changeMyPassword } from './user.profile.service.js';
export {
  REQUIRED_IDENTITY_ROLES,
  ORGANIZATION_ROLES,
  normalizeDocumentIdentity,
  assertValidEmailDomain,
  rejectSuperAdminOnTenant,
  notFoundIfMissing,
  hashPassword,
} from './user.helpers.js';

import { listUsers, getMe, getUserById } from './user.read.service.js';
import { createUser, createUsersBulk } from './user.create.service.js';
import { provisionAdmin, provisionExistingAdmin } from './user.provision.service.js';
import {
  updateUser,
  setActiveStatus,
  unlockUser,
  updateUserRole,
} from './user.update.service.js';
import { updateMyProfile, changeMyPassword } from './user.profile.service.js';

export default {
  listUsers,
  getMe,
  getUserById,
  createUser,
  provisionAdmin,
  provisionExistingAdmin,
  createUsersBulk,
  updateUser,
  setActiveStatus,
  unlockUser,
  updateUserRole,
  updateMyProfile,
  changeMyPassword,
};
