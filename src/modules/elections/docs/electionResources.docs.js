/**
 * S4-12 — Documentación Swagger de los sub-recursos de una elección:
 * cargos, listas candidatas, candidaturas y reglas.
 *
 * Todos van anidados bajo /api/elections/{electionId}/... y comparten
 * dos reglas: la escritura solo se admite con la elección en DRAFT, y el
 * recurso debe pertenecer a esa elección (si no, 404).
 *
 * @openapi
 * /api/elections/{electionId}/positions:
 *   get:
 *     summary: Listar los cargos de una elección
 *     description: No se pagina; la papeleta necesita siempre la lista completa.
 *     tags: [Election Positions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: electionId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Cargos de la elección }
 *       404: { description: La elección no existe }
 *   post:
 *     summary: Crear un cargo (solo con la elección en DRAFT)
 *     tags: [Election Positions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: electionId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, maxLength: 120, example: Presidente }
 *               description: { type: string, nullable: true }
 *               seats: { type: integer, minimum: 1, maximum: 32767, default: 1 }
 *     responses:
 *       201: { description: Cargo creado }
 *       409: { description: Nombre repetido en la elección, o elección fuera de DRAFT }
 *
 * /api/elections/{electionId}/positions/{id}:
 *   get:
 *     summary: Obtener un cargo
 *     tags: [Election Positions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: electionId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Cargo encontrado }
 *       404: { description: El cargo no existe en esta elección }
 *   put:
 *     summary: Actualizar un cargo (solo con la elección en DRAFT)
 *     tags: [Election Positions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: electionId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Cargo actualizado }
 *       409: { description: La elección ya no está en DRAFT }
 *   delete:
 *     summary: Eliminar un cargo
 *     description: Se rechaza si el cargo tiene candidaturas asociadas.
 *     tags: [Election Positions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: electionId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Cargo eliminado }
 *       409: { description: Tiene candidaturas, o la elección no está en DRAFT }
 */

/**
 * @openapi
 * /api/elections/{electionId}/candidate-lists:
 *   get:
 *     summary: Listar las listas candidatas de una elección
 *     tags: [Election Candidate Lists]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: electionId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Listas de la elección }
 *   post:
 *     summary: Crear una lista candidata (solo con la elección en DRAFT)
 *     description: >
 *       acronym, motto y logo admiten null o cadena vacía; una cadena vacía
 *       se almacena como null porque la base de datos no admite texto en blanco.
 *     tags: [Election Candidate Lists]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: electionId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, maxLength: 120, example: Unidad Estudiantil }
 *               acronym: { type: string, maxLength: 20, nullable: true, example: UE }
 *               motto: { type: string, maxLength: 255, nullable: true }
 *               logo: { type: string, maxLength: 500, nullable: true }
 *     responses:
 *       201: { description: Lista creada }
 *       409: { description: Nombre repetido, o elección fuera de DRAFT }
 *
 * /api/elections/{electionId}/candidate-lists/{id}:
 *   get:
 *     summary: Obtener una lista candidata
 *     tags: [Election Candidate Lists]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: electionId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Lista encontrada }
 *       404: { description: La lista no existe en esta elección }
 *   put:
 *     summary: Actualizar una lista candidata (solo en DRAFT)
 *     tags: [Election Candidate Lists]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: electionId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Lista actualizada }
 *   delete:
 *     summary: Eliminar una lista candidata
 *     description: Se rechaza si la lista tiene candidaturas asociadas.
 *     tags: [Election Candidate Lists]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: electionId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Lista eliminada }
 *       409: { description: Tiene candidaturas, o la elección no está en DRAFT }
 */

/**
 * @openapi
 * /api/elections/{electionId}/candidacies:
 *   get:
 *     summary: Listar candidaturas de una elección
 *     tags: [Election Candidacies]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: electionId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: candidate_list_id, schema: { type: string, format: uuid } }
 *       - { in: query, name: position_id, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Candidaturas con un resumen del usuario candidato }
 *   post:
 *     summary: Registrar una candidatura (solo con la elección en DRAFT)
 *     description: >
 *       La lista y el cargo deben pertenecer a la misma elección. El usuario
 *       debe existir, tener la cuenta activa y no ser ya candidato en esta
 *       elección (una persona, una sola candidatura por elección).
 *     tags: [Election Candidacies]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: electionId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [candidate_list_id, user_id]
 *             properties:
 *               candidate_list_id: { type: string, format: uuid }
 *               user_id: { type: string, format: uuid }
 *               position_id: { type: string, format: uuid, nullable: true }
 *               order_index: { type: integer, minimum: 1, default: 1 }
 *               is_principal: { type: boolean, default: true }
 *     responses:
 *       201: { description: Candidatura registrada }
 *       400: { description: Lista, cargo o usuario no válidos para esta elección }
 *       409: { description: El usuario ya es candidato en esta elección o en ese cargo }
 *
 * /api/elections/{electionId}/candidacies/{id}:
 *   get:
 *     summary: Obtener una candidatura
 *     tags: [Election Candidacies]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: electionId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Candidatura encontrada }
 *       404: { description: No existe en esta elección }
 *   put:
 *     summary: Actualizar una candidatura (solo en DRAFT)
 *     description: user_id no es modificable; cambiar la persona equivale a otra candidatura.
 *     tags: [Election Candidacies]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: electionId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Candidatura actualizada }
 *   delete:
 *     summary: Retirar una candidatura (solo en DRAFT)
 *     tags: [Election Candidacies]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: electionId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Candidatura retirada }
 */

/**
 * @openapi
 * /api/elections/{electionId}/rules:
 *   get:
 *     summary: Obtener las reglas de la elección
 *     description: Recurso singular; la relación con la elección es 1:1.
 *     tags: [Election Rules]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: electionId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Reglas configuradas }
 *       404: { description: La elección aún no tiene reglas }
 *   post:
 *     summary: Configurar las reglas (una sola vez, solo en DRAFT)
 *     tags: [Election Rules]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: electionId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               min_turnout_percentage:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Quórum mínimo. Máximo 2 decimales.
 *                 example: 33.33
 *               allow_blank_vote: { type: boolean, default: true }
 *               allow_null_vote: { type: boolean, default: true }
 *               max_positions_per_ballot: { type: integer, minimum: 1, default: 1 }
 *               requires_2fa: { type: boolean, default: true }
 *     responses:
 *       201: { description: Reglas configuradas }
 *       409: { description: Ya existen reglas (usar PUT), o elección fuera de DRAFT }
 *   put:
 *     summary: Modificar las reglas (solo en DRAFT)
 *     tags: [Election Rules]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: electionId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Reglas actualizadas }
 *       404: { description: Aún no hay reglas creadas (usar POST) }
 *   delete:
 *     summary: Eliminar las reglas (solo en DRAFT)
 *     tags: [Election Rules]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: electionId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Reglas eliminadas }
 */
