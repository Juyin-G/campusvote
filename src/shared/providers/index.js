// src/shared/providers/index.js
import identityProvider from './identityProvider.js';
import messagingProvider from './messagingProvider.js';

export { identityProvider, messagingProvider };
export { MockIdentityProvider, IdentityProvider } from './identityProvider.js';
export { MockMessagingProvider, MessagingProvider } from './messagingProvider.js';