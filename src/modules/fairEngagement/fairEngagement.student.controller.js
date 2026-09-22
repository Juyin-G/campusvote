// src/modules/fairEngagement/fairEngagement.student.controller.js
// Capa HTTP para la vista de engagement de integrantes.

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';
import { getProjectEngagement } from './fairEngagement.student.service.js';

const actorId = (user) => user?.userId ?? user?.id;
const getActor = (user) => ({
  id: actorId(user) || user?.id,
  role: user?.role,
  organizationId: user?.organizationId || null,
});

export const getEngagement = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    await getProjectEngagement({
      fairId: req.params.fairId,
      projectId: req.params.projectId,
      actor: getActor(req.user),
    }),
    'Engagement del proyecto',
    {},
    HTTP_STATUS.OK
  )
);

export default { getEngagement };
