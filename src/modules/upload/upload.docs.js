/**
 * @swagger
 * tags:
 *   name: Uploads
 *   description: Subida de archivos (imágenes, PDFs) para ferias, avatares y proyectos.
 */

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Subir un archivo
 *     description: Sube un archivo (imagen o PDF) al servidor y devuelve su URL pública. Útil para logotipos de proyectos o avatares.
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: El archivo a subir (máx 5MB). Solo se permiten JPG, PNG, WEBP y PDF.
 *     responses:
 *       201:
 *         description: Archivo subido correctamente
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
 *                   example: Archivo subido correctamente
 *                 data:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       example: http://localhost:3000/uploads/file-1a2b3c4d.jpg
 *                     mimetype:
 *                       type: string
 *                       example: image/jpeg
 *                     size:
 *                       type: integer
 *                       example: 1048576
 *       400:
 *         description: Archivo inválido o ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: No autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/Unauthorized'
 */
