// src/modules/PlatformTranslation/PlatformTranslation.docs.js

/**
 * @swagger
 * tags:
 *   name: Platform Translations
 *   description: Gestión del diccionario de internacionalización (i18n) y locales de usuario
 */

/**
 * @swagger
 * /api/platform/translations/dictionary:
 *   get:
 *     summary: Obtener diccionario de traducciones (Optimizado)
 *     description: "Obtiene un objeto JSON con las traducciones para un locale y categoría específicos. Utiliza una función SQL nativa que maneja automáticamente el fallback de idiomas."
 *     tags: [Platform Translations]
 *     parameters:
 *       - in: query
 *         name: locale
 *         schema:
 *           type: string
 *           default: es-PE
 *         description: "Código de idioma (ej: es-PE, en-US)"
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: "Filtrar por categoría (ej: general, auth)"
 *     responses:
 *       200:
 *         description: Diccionario de traducciones
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
 *                   example: "Diccionario de traducciones obtenido exitosamente"
 *                 data:
 *                   type: object
 *                   additionalProperties:
 *                     type: string
 *                   example:
 *                     "auth.login.title": "Iniciar Sesión"
 *                     "auth.login.button": "Ingresar"
 */

/**
 * @swagger
 * /api/platform/translations:
 *   get:
 *     summary: Listar todas las traducciones (Admin)
 *     description: "Obtiene la lista completa de entradas del diccionario para administración."
 *     tags: [Platform Translations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de traducciones
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PlatformTranslation'
 *   post:
 *     summary: Crear una nueva traducción
 *     description: "Agrega una nueva clave de traducción con sus valores por idioma."
 *     tags: [Platform Translations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - translation_key
 *               - values
 *             properties:
 *               translation_key:
 *                 type: string
 *                 pattern: "^[a-z0-9._-]+$"
 *                 example: "auth.login.submit"
 *               category:
 *                 type: string
 *                 default: "general"
 *                 example: "general"
 *               values:
 *                 type: object
 *                 additionalProperties:
 *                   type: string
 *                 example:
 *                   es-PE: "Enviar Voto"
 *                   en-US: "Submit Vote"
 *     responses:
 *       201:
 *         description: Traducción creada
 *       409:
 *         description: Conflicto (la clave ya existe)
 */

/**
 * @swagger
 * /api/platform/translations/{id}:
 *   patch:
 *     summary: Actualizar una traducción
 *     description: "Modifica parcialmente una entrada de traducción existente."
 *     tags: [Platform Translations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               translation_key:
 *                 type: string
 *               category:
 *                 type: string
 *               values:
 *                 type: object
 *     responses:
 *       200:
 *         description: Traducción actualizada
 *   delete:
 *     summary: Eliminar una traducción
 *     description: "Elimina una entrada del diccionario."
 *     tags: [Platform Translations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Traducción eliminada
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     PlatformTranslation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         translation_key:
 *           type: string
 *           description: "Clave única en formato snake_case o dot notation (ej: auth.login)"
 *         category:
 *           type: string
 *         values:
 *           type: object
 *           description: "Objeto JSON con los pares locale: texto"
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */