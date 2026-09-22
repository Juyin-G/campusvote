// src/modules/fairEngagement/fairEngagement.notifications.js
// Notificaciones a los expositores (integrantes del proyecto) por likes
// y comentarios. Dedupe de hitos en BD.

import * as engagementRepository from './fairEngagement.repository.js';
import * as notificationService from '../notification/notification.service.js';
import * as projectRepository from '../projects/project.repository.js';
import auditService from '../audit/audit.service.js';
import { ROLES } from '../../constants/roles.js';
import { nextMilestone } from './fairEngagement.helpers.js';
import logger from '../../config/logger.js';

/** Devuelve los user_id de los integrantes del proyecto (expositores). */
const getExpositorIds = async (projectId) => {
  const members = await projectRepository.listMembers(projectId);
  return (members || [])
    .filter((m) => m.user && m.user.role === ROLES.STUDENT)
    .map((m) => m.user.id);
};

/**
 * Notifica a los expositores que recibieron un nuevo "Me gusta".
 * El trigger `enforce_fair_engagement_state` ya validó que la feria está
 * OPEN y el proyecto APPROVED.
 */
export const notifyProjectLiked = async ({ fairId, projectId, juryUserId, projectName }) => {
  const expositorIds = await getExpositorIds(projectId);
  if (expositorIds.length === 0) return;
  try {
    await Promise.all(
      expositorIds.map((userId) =>
        notificationService.createNotification({
          user_id: userId,
          type: 'PROJECT_LIKED',
          title: 'Tu proyecto recibió un nuevo Me gusta',
          message: `${projectName || 'Tu proyecto'} recibió un nuevo interés de un jurado.`,
          metadata: { fair_id: fairId, project_id: projectId },
          channels: ['IN_APP'],
        })
      )
    );
    await auditService.logAction({
      actorId: juryUserId,
      electionId: null,
      action: 'PROJECT_LIKED',
      metadata: { fair_id: fairId, project_id: projectId },
    });
  } catch (err) {
    logger.warn('No se pudo notificar PROJECT_LIKED', { error: err.message });
  }
};

/**
 * Notifica a los expositores que recibieron un nuevo comentario.
 */
export const notifyProjectCommented = async ({
  fairId,
  projectId,
  juryUserId,
  projectName,
}) => {
  const expositorIds = await getExpositorIds(projectId);
  if (expositorIds.length === 0) return;
  try {
    await Promise.all(
      expositorIds.map((userId) =>
        notificationService.createNotification({
          user_id: userId,
          type: 'PROJECT_COMMENTED',
          title: 'Tu proyecto recibió una nueva observación',
          message: `Un jurado dejó una retroalimentación sobre ${projectName || 'tu proyecto'}.`,
          metadata: { fair_id: fairId, project_id: projectId },
          channels: ['IN_APP'],
        })
      )
    );
    await auditService.logAction({
      actorId: juryUserId,
      electionId: null,
      action: 'PROJECT_COMMENTED',
      metadata: { fair_id: fairId, project_id: projectId },
    });
  } catch (err) {
    logger.warn('No se pudo notificar PROJECT_COMMENTED', { error: err.message });
  }
};

/**
 * Verifica si el nuevo conteo cruza un hito no notificado y notifica
 * UNA sola vez por proyecto/umbral (dedupe vía BD).
 * Llamar DESPUÉS de crear el like, en la misma transacción lógica.
 */
export const notifyLikeMilestoneIfReached = async ({ fairId, projectId, newCount, projectName }) => {
  const milestone = nextMilestone(newCount);
  if (!milestone) return; // No se alcanzó ningún hito configurado.

  const already = await engagementRepository.listNotifiedMilestones(projectId);
  if (already.has(milestone)) return;

  try {
    await engagementRepository.markMilestoneNotified(projectId, milestone);
  } catch (err) {
    // Si ya existe (race condition), ignorar: otro proceso lo marcó primero.
    if (err?.code !== 'P2002') throw err;
    return;
  }

  const expositorIds = await getExpositorIds(projectId);
  if (expositorIds.length === 0) return;

  try {
    await Promise.all(
      expositorIds.map((userId) =>
        notificationService.createNotification({
          user_id: userId,
          type: 'PROJECT_LIKE_MILESTONE',
          title: `🎉 Tu proyecto alcanzó ${milestone} Me gusta`,
          message: `${projectName || 'Tu proyecto'} recibió ${milestone} Me gusta de jurados.`,
          metadata: { fair_id: fairId, project_id: projectId, milestone },
          channels: ['IN_APP'],
        })
      )
    );
  } catch (err) {
    logger.warn('No se pudo notificar PROJECT_LIKE_MILESTONE', { error: err.message });
  }
};
