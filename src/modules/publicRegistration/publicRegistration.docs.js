/**
 * @openapi
 * tags:
 *   - name: Inscripción pública
 *     description: >
 *       Página pública de inscripción de proyectos de feria. No usa sesión de
 *       CampusVote: la identidad se prueba con un código de 6 dígitos enviado
 *       al correo institucional, y el permiso temporal que se entrega viaja en
 *       la cabecera X-Registration-Token.
 */

/**
 * @openapi
 * /api/public/inscripciones/{token}:
 *   get:
 *     tags: [Inscripción pública]
 *     summary: Datos de la feria y la marca de la institución
 *     security: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *         description: Código del enlace que reparte el admin.
 *     responses:
 *       200:
 *         description: Feria, categorías, plazo y colores/logo de la institución.
 *       404:
 *         description: El enlace no existe, está apagado o la feria terminó.
 */

/**
 * @openapi
 * /api/public/inscripciones/{token}/codigo:
 *   post:
 *     tags: [Inscripción pública]
 *     summary: Envía el código de verificación al correo institucional
 *     description: >
 *       Responde igual exista o no la persona, para que el enlace no sirva
 *       para averiguar quién pertenece a la institución.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: Código enviado (si el correo corresponde). }
 *       409: { description: El plazo de inscripción ya cerró. }
 *       429: { description: Demasiados códigos pedidos desde esta IP. }
 */

/**
 * @openapi
 * /api/public/inscripciones/{token}/sesion:
 *   post:
 *     tags: [Inscripción pública]
 *     summary: Canjea el código por un permiso temporal
 *     security: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email: { type: string, format: email }
 *               code: { type: string, example: '482915' }
 *     responses:
 *       200:
 *         description: Permiso temporal, datos de la persona y su proyecto si ya lo inscribió.
 *       400: { description: Código incorrecto o vencido. }
 *       429: { description: Demasiados intentos con el mismo código. }
 */

/**
 * @openapi
 * /api/public/inscripciones/{token}/proyecto:
 *   get:
 *     tags: [Inscripción pública]
 *     summary: Mi inscripción en esta feria
 *     security: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *       - in: header
 *         name: X-Registration-Token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Proyecto propio con su estado y observaciones. }
 *       401: { description: Sin permiso temporal o ya venció. }
 *   post:
 *     tags: [Inscripción pública]
 *     summary: Inscribe el proyecto y lo envía a revisión
 *     description: >
 *       El estudiante queda como responsable y expositor; el docente, como
 *       asesor (y entonces debe agregar al menos un estudiante). Los
 *       integrantes se indican por correo institucional.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *       - in: header
 *         name: X-Registration-Token
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               category_id: { type: string, format: uuid, nullable: true }
 *               project_url: { type: string, nullable: true }
 *               members:
 *                 type: array
 *                 items: { type: string, format: email }
 *     responses:
 *       201: { description: Proyecto inscrito y enviado a revisión. }
 *       400: { description: Datos inválidos o integrante que no es de la institución. }
 *       409: { description: Ya participa en un proyecto de esta feria, o el plazo cerró. }
 *   put:
 *     tags: [Inscripción pública]
 *     summary: Corrige las observaciones y reenvía a revisión
 *     security: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *       - in: header
 *         name: X-Registration-Token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Proyecto corregido y reenviado. }
 *       403: { description: Solo quien inscribió el proyecto puede corregirlo. }
 *       409: { description: El proyecto no está en un estado editable. }
 */

/**
 * @openapi
 * /api/fairs/{id}/public-registration:
 *   post:
 *     tags: [Ferias]
 *     summary: Enciende o apaga el enlace público de inscripción
 *     description: >
 *       Al encenderlo por primera vez se genera la dirección pública. Al
 *       apagarlo, la página deja de responder y caducan los permisos
 *       temporales en curso. `regenerate` crea una dirección nueva e invalida
 *       la anterior.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [enabled]
 *             properties:
 *               enabled: { type: boolean }
 *               regenerate: { type: boolean }
 *     responses:
 *       200: { description: Feria con el estado del enlace y su dirección. }
 *       409: { description: La feria terminó o su plazo de inscripción ya venció. }
 */
