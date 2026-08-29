import { Router } from 'express';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { ROLES } from '../../../constants/roles.js';
import * as facultyController from './faculty.controller.js';
import * as facultySchema from './faculty.schema.js';

const router = Router();

// Middleware de autenticación y autorización para el módulo completo de facultades
router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/', facultyController.getFaculties);

router.post(
  '/', 
  validate(facultySchema.createFacultySchema), 
  facultyController.createFaculty
);

router.get(
  '/:id', 
  validate(facultySchema.idParamSchema), 
  facultyController.getFacultyById
);

router.put(
  '/:id', 
  validate(facultySchema.updateFacultySchema), // 👈 Corregido
  facultyController.updateFaculty
);

router.delete(
  '/:id', 
  validate(facultySchema.idParamSchema), 
  facultyController.deleteFaculty
);

export default router;