# Guía de Próximos Pasos y Prompts de Desarrollo (CampusVote)

Este documento es tu **Manual de Operaciones para la IA**. Contiene la hoja de ruta estructurada y los **prompts exactos** que puedes darle a cualquier modelo de Inteligencia Artificial para que continúe desarrollando tu sistema de forma armónica, escalable y sin huecos de lógica.

> **NOTA DEL ARQUITECTO:** La **Fase 1 (Saneamiento y Reparación Arquitectónica)** ya fue ejecutada. El enrutamiento de organizaciones, la reparación de la capa de persistencia y la eliminación de código duplicado ya están listos. A partir de aquí, el código fluye correctamente.

---

## Estado Actual Revisado (Checklist de Lógica)
✅ **Autenticación y Seguridad:** El flujo de JWT, roles y contraseñas está perfecto. Tiene buenas defensas (bloqueo por reintentos, bcrypt, 2FA temporal).
✅ **Validadores Zod:** Limpiados. Solo existe un validador central (`validate.middleware.js`) y las reglas de Swagger están bien referenciadas.
⚠️ **.env Faltante:** Como recordatorio, te faltan credenciales SMTP y `FRONTEND_URL` en tu archivo `.env`. (Revisa el `.env.example`).
❌ **God Object en Organizaciones:** `organization.repository.js` sigue teniendo funciones de Facultades, Programas y Periodos Académicos que deben ir al módulo `academic`.
❌ **Módulos Electorales Vacíos:** `elections`, `voting`, `ballots`, `results` están completamente vacíos. Falta el core del negocio (crear la elección y emitir votos).

---

## Fase 2: Desacoplamiento (Patrón de Dominio)

**Objetivo:** Preparar la escalabilidad separando entidades de forma lógica. Evita huecos donde los roles se mezclen y aísla la estructura académica de la de negocios (organización).

### Tarea 2.1: Separar el módulo Académico del "God Object"
Copia y pega este prompt:
> "Actúa como Arquitecto de Software. El archivo `src/modules/organizations/organization.repository.js` es un 'God Object' que maneja base de datos para Facultades, Programas y Periodos Académicos. Desacopla esa lógica: crea un `academic.repository.js`, un `academic.service.js`, un `academic.controller.js` y un `academic.routes.js` dentro del directorio `src/modules/academic/`. Mueve toda la lógica de faculties, programs y periods allí y retírala del repositorio de organizaciones. Luego, importa las rutas en `src/routes/index.js` bajo el path `/academic`."

---

## Fase 3: Desarrollo Core del Flujo de Negocio (Escalabilidad Electoral)

**Objetivo:** Desarrollar los módulos clave para realizar una elección, manteniendo inmutabilidad y seguridad criptográfica. Aquí se cierran los huecos lógicos principales (validar si el usuario puede votar).

### Tarea 3.1: Desarrollar Módulo de Elecciones
Copia y pega este prompt:
> "Desarrolla el módulo `elections` en `src/modules/elections/`. Crea las capas Routes, Controller, Service y Repository usando el mismo formato arquitectónico del proyecto. Necesito un CRUD completo para las Elecciones y para las Candidaturas (`candidacies`), permitiendo que el rol ORG_ADMIN asigne candidatos a una elección. Asegúrate de usar transacciones de Prisma cuando se modifiquen listas de candidatos e incluye validación con Zod en las rutas."

### Tarea 3.2: Padrón Electoral (Filtro de Votantes)
Copia y pega este prompt:
> "Extiende el módulo `elections` agregando la gestión del Padrón Electoral (`voter_registries`). Esto cierra el hueco lógico de quién puede votar. Crea endpoints para que el ORG_ADMIN agregue usuarios a una elección específica. Implementa un método masivo en el servicio (`addBulkToRegistry`) que reciba un array de IDs de usuarios. Aplica paginación en el listado y valida en base de datos (con Prisma) que un usuario no pueda ser agregado dos veces a la misma elección."

### Tarea 3.3: Módulo de Votación y Boletas (Altamente Crítico)
Copia y pega este prompt:
> "Desarrolla los módulos `voting` y `ballots`. La lógica debe ser transaccional e inmutable para evitar fraude. 
> 1. Crea un endpoint en `voting` donde un usuario autenticado pueda solicitar votar en una elección activa.
> 2. Reglas lógicas (Huecos a evitar): Verifica que la elección esté 'OPEN', que el usuario pertenezca al padrón de la elección (Voter Registry) y que NO haya votado antes.
> 3. Almacenaje: En `ballots`, registra el voto asociado al candidato elegido pero DESVINCULADO del usuario para mantener el secreto del voto. En una misma transacción de Prisma (indivisible), marca al usuario en `voter_registries` como 'ya votó'."

### Tarea 3.4: Escrutinio y Resultados
Copia y pega este prompt:
> "Desarrolla el módulo `results`. Crea un endpoint público (solo accesible cuando la elección haya pasado su fecha de fin o su estado sea CLOSED). Este endpoint debe tabular de forma agregada los votos leyendo directamente desde la tabla `ballots`. El servicio nunca debe devolver información individual (boleta a boleta), sino sumarizar el total de votos por candidato, y devolver un reporte JSON estadístico. Implementa esto usando agrupaciones eficientes de base de datos en `results.repository.js`."
