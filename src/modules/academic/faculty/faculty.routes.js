import { Router } from 'express';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import * as facultyController from './faculty.controller.js';
import * as facultySchema from './faculty.schema.js';

const router = Router();

// Middleware global para todas las rutas de facultades
router.use(authenticate, authorize('ADMIN', 'ORG_ADMIN'));

router.get('/', facultyController.getFaculties);
router.post('/', validate(facultySchema.createFacultySchema), facultyController.createFaculty);
router.get('/:id', validate(facultySchema.idParamSchema), facultyController.getFacultyById);
router.put('/:id', validate(facultySchema.idParamSchema), facultyController.updateFaculty);
router.delete('/:id', validate(facultySchema.idParamSchema), facultyController.deleteFaculty);

export default router;