/**
 * @swagger
 * tags:
 *   name: Health
 *   description: Monitoreo y diagnóstico del estado de la infraestructura
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Verificar disponibilidad del servicio
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Servicio operativo
 */

/**
 * @swagger
 * /api/health/db:
 *   get:
 *     summary: Verificar conexión con la base de datos
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Conexión a la base de datos verificada
 *       500:
 *         description: No se pudo conectar con la base de datos
 */
