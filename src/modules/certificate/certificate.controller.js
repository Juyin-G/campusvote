// src/modules/certificate/certificate.controller.js
// Controller delgado para certificados oficiales de FERIAS.
// Toda la lógica de negocio vive en certificate.service.js.
// El acceso a Prisma vive en certificate.repository.js.

import * as certificateService from './certificate.service.js';
import { generateCertificatePdf } from './certificate.pdf.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';

const getActorId = (user) => user?.userId ?? user?.id ?? null;

const getActor = (user) => ({
  id: getActorId(user) || user?.id,
  role: user?.role,
  organizationId: user?.organizationId || null,
  isSuperAdmin: user?.isSuperAdmin || false,
  isSuperuser: user?.isSuperuser || false,
});

// POST /api/fairs/:id/certificates/generate
export const generateCertificates = asyncHandler(async (req, res) => {
  const result = await certificateService.generateCertificates({
    fairId: req.params.id,
    actor: getActor(req.user),
  });
  return sendCreated(res, result, 'Certificados generados correctamente');
});

// GET /api/certificates/my
export const listMyCertificates = asyncHandler(async (req, res) => {
  const result = await certificateService.listMyCertificates({
    actor: getActor(req.user),
  });
  return sendSuccess(
    res,
    result,
    'Certificados del usuario obtenidos correctamente',
    {},
    HTTP_STATUS.OK
  );
});

// GET /api/certificates/:certificateId
export const getCertificateById = asyncHandler(async (req, res) => {
  const result = await certificateService.getCertificateById({
    certificateId: req.params.certificateId,
    actor: getActor(req.user),
  });
  return sendSuccess(
    res,
    result,
    'Certificado obtenido correctamente',
    {},
    HTTP_STATUS.OK
  );
});

// GET /api/certificates/:certificateId/pdf
export const downloadCertificatePdf = asyncHandler(async (req, res) => {
  const cert = await certificateService.getCertificateById({
    certificateId: req.params.certificateId,
    actor: getActor(req.user),
  });

  const buffer = await generateCertificatePdf({
    certificate: {
      id: cert.id,
      issue_date: cert.issue_date,
      certificate_type: cert.certificate_type,
      description: cert.description,
      valid_until: cert.valid_until,
    },
    fair: {
      id: cert.fair?.id,
      name: cert.fair?.name,
    },
    project: {
      id: cert.project?.id,
      name: cert.project?.name,
    },
    participant: {
      id: cert.participant?.id,
      first_name: cert.participant?.first_name,
      last_name: cert.participant?.last_name,
    },
  });

  const filename = `certificate-${cert.id}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', String(buffer.length));
  return res.status(HTTP_STATUS.OK).send(buffer);
});

export default {
  generateCertificates,
  listMyCertificates,
  getCertificateById,
  downloadCertificatePdf,
};