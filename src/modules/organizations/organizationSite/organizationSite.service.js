// src/modules/organizations/organizationSite/organizationSite.service.js
// Lógica de negocio de SEDES de organizaciones.
//
// Estructura:
//   Organization ── OrganizationSite ── Fair (fairs.site_id)
//
// Autorización:
//   - ADMIN gestiona las sedes de SU organización (aislamiento por tenant).
//   - SUPERADMIN conserva el bypass de tenant (lectura global de sedes).
//   - El resto de roles NO recibe permisos nuevos.
//   - Crear una sede requiere estar vinculado a una organización
//     (el SUPERADMIN sin organización no puede crear sedes "sueltas").

import * as siteRepository from './organizationSite.repository.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { ROLES } from '../../../constants/roles.js';

const isSuperAdmin = (actor) =>
  actor.role === ROLES.SUPERADMIN || actor.isSuperAdmin || actor.isSuperuser;

const mapSite = (site) => ({
  id: site.id,
  organization_id: site.organizationId,
  name: site.name,
  address: site.address,
  city: site.city,
  latitude: site.latitude !== null && site.latitude !== undefined ? Number(site.latitude) : null,
  longitude: site.longitude !== null && site.longitude !== undefined ? Number(site.longitude) : null,
  created_at: site.createdAt,
  updated_at: site.updatedAt,
});

const loadSite = async (siteId) => {
  const site = await siteRepository.findById(siteId);
  if (!site) {
    throw ApiError.notFound('Sede no encontrada');
  }
  return site;
};

const assertTenantMatch = ({ site, actor }) => {
  if (isSuperAdmin(actor)) return;
  if (!actor.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }
  if (site.organizationId !== actor.organizationId) {
    throw ApiError.forbidden('La sede no pertenece a tu organización');
  }
};

// ── Operaciones ────────────────────────────────────────────────────

export const listSites = async ({ actor }) => {
  if (isSuperAdmin(actor)) {
    const sites = await siteRepository.listAll();
    return { data: sites.map(mapSite) };
  }

  if (!actor.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }

  const sites = await siteRepository.listByOrganization(actor.organizationId);
  return { data: sites.map(mapSite) };
};

export const getSiteById = async ({ siteId, actor }) => {
  const site = await loadSite(siteId);
  assertTenantMatch({ site, actor });
  return mapSite(site);
};

export const createSite = async ({ data, actor }) => {
  if (!actor.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }

  const site = await siteRepository.create({
    organizationId: actor.organizationId,
    name: data.name,
    address: data.address ?? null,
    city: data.city ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
  });

  return mapSite(site);
};

export const updateSite = async ({ siteId, data, actor }) => {
  const site = await loadSite(siteId);
  assertTenantMatch({ site, actor });

  const updated = await siteRepository.update(siteId, {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.address !== undefined ? { address: data.address || null } : {}),
    ...(data.city !== undefined ? { city: data.city || null } : {}),
    ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
    ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
  });

  return mapSite(updated);
};

export const deleteSite = async ({ siteId, actor }) => {
  const site = await loadSite(siteId);
  assertTenantMatch({ site, actor });

  await siteRepository.remove(siteId);

  return { deleted: true, site_id: siteId };
};

export default {
  listSites,
  getSiteById,
  createSite,
  updateSite,
  deleteSite,
};