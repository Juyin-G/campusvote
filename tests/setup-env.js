process.env.NODE_ENV = 'test';

import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

// Límite global de la API (app.js): 100 peticiones cada 15 min por IP. Los
// flujos de punta a punta (tecsup.flujo-completo) hacen más desde la misma IP.
// Solo aplica a las pruebas; en producción sigue el valor de Render.
process.env.RATE_LIMIT_MAX_REQUESTS ??= '100000';
