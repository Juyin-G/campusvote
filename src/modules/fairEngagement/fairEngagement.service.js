// src/modules/fairEngagement/fairEngagement.service.js
// Orquestador del módulo de engagement.
// Re-exporta la API pública desde los sub-servicios (likes + comments).

export {
  likeProject,
  unlikeProject,
  getLikeStatus,
} from './fairEngagement.likes.service.js';
export {
  createComment,
  listComments,
  updateComment,
  deleteComment,
} from './fairEngagement.comments.service.js';

import {
  likeProject,
  unlikeProject,
  getLikeStatus,
} from './fairEngagement.likes.service.js';
import {
  createComment,
  listComments,
  updateComment,
  deleteComment,
} from './fairEngagement.comments.service.js';

export default {
  likeProject,
  unlikeProject,
  getLikeStatus,
  createComment,
  listComments,
  updateComment,
  deleteComment,
};
