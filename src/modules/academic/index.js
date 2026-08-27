// src/modules/academic/index.js

import academicRoutes from './academic.routes.js';
import facultyDocs from './faculty/faculty.docs.js';
import programDocs from './program/program.docs.js';
import periodDocs from './period/period.docs.js';
import voterRegistryDocs from './voter-registry/voter-registry.docs.js';

export const academicDocs = {
  ...facultyDocs,
  ...programDocs,
  ...periodDocs,
  ...voterRegistryDocs,
};

export default academicRoutes;