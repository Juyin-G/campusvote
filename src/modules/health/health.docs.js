/**
 * @openapi
 * /health:
 *   get:
 *     summary: Verificar estado del servidor
 *     description: Endpoint para verificar que el servidor está funcionando correctamente
 *     tags:
 *       - Health
 *     security: []
 *     responses:
 *       200:
 *         description: Servidor funcionando correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Server is running
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Tiempo en segundos desde que inició el servidor
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /health/db:
 *   get:
 *     summary: Verificar conexión a base de datos
 *     description: Verifica que la conexión a PostgreSQL está funcionando
 *     tags:
 *       - Health
 *     security: []
 *     responses:
 *       200:
 *         description: Base de datos conectada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Database connection successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                       example: true
 *                     latency:
 *                       type: number
 *                       description: Latencia en milisegundos
 *       500:
 *         description: Error de conexión a base de datos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */