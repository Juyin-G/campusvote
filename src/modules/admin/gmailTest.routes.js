import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { sendRaw } from '../../shared/services/gmail.client.js';
import { sendSuccess } from '../../shared/utils/apiResponse.js';

const router = Router();

const schema = z.object({
  body: z.object({
    to: z.string().email('El destinatario debe ser un correo válido'),
  }),
});

router.post(
  '/admin/gmail/test',
  authenticate,
  authorize([ROLES.SUPERADMIN]),
  validate(schema),
  asyncHandler(async (req, res) => {
    const { to } = req.body;
    const result = await sendRaw({
      to,
      subject: 'Prueba de correo CampusVote',
      text: 'Este correo confirma que Gmail API funciona en el backend de Render.',
      html: '<p>Este correo confirma que Gmail API funciona en el backend de Render.</p>',
    });

    return sendSuccess(
      res,
      { sent: true, to, messageId: result.messageId },
      'Correo de prueba enviado',
    );
  }),
);

export default router;
