// src/services/adminScope.service.js
// Orquestador del servicio de scope administrativo multi-sede.
// Re-exporta la API pública desde los sub-servicios (read + write).

export {
  resolveAccessibleSites,
  getAccessibleSiteIds,
  actorHasSiteAccess,
  actorHasRegionAccess,
  actorHasOrgAccess,
} from './adminScope.read.service.js';
export { canCreateScope, assignSiteScopes } from './adminScope.write.service.js';

import {
  resolveAccessibleSites,
  getAccessibleSiteIds,
  actorHasSiteAccess,
  actorHasRegionAccess,
  actorHasOrgAccess,
} from './adminScope.read.service.js';
import { canCreateScope, assignSiteScopes } from './adminScope.write.service.js';

export default {
  resolveAccessibleSites,
  getAccessibleSiteIds,
  actorHasSiteAccess,
  actorHasRegionAccess,
  actorHasOrgAccess,
  canCreateScope,
  assignSiteScopes,
};
