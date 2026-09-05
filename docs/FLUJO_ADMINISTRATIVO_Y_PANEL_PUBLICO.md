# Flujo administrativo y panel publico

## Objetivo

Separar claramente la experiencia publica de demo de la operacion administrativa real. El visitante puede revisar el producto sin obtener permisos reales ni datos sensibles.

## Flujo desde el index

1. El visitante entra al index.
2. Selecciona **Revisar demo**.
3. El sistema abre un entorno demo aislado, con datos anonimizados y acciones de solo lectura.
4. El visitante puede revisar:
   - calendario y estado de una eleccion;
   - cargos, listas y candidaturas;
   - criterios de evaluacion;
   - resultados simulados;
   - comprobacion de un recibo de ejemplo.
5. Para operar, el usuario sale de demo y selecciona **Iniciar sesion**.
6. El backend autentica, valida email, aplica MFA si esta habilitado y devuelve la sesion.
7. El frontend construye el panel segun el rol recibido; el backend sigue siendo la autoridad.

La pagina actual es una demo de login/logout. No existe aun un panel publico de demo completo en este repositorio; debe implementarse sin reutilizar datos de produccion.

## Estados de acceso

| Estado | Acceso |
|---|---|
| Publico | Index, documentacion publica, landing de elecciones y verificacion de recibo |
| Demo | Lectura de datos sinteticos; sin mutaciones, sin exportacion sensible y sin acceso a BD de produccion |
| Autenticado sin MFA completado | Solo endpoint de verificacion TOTP |
| Estudiante/elector activo | Padron valido y flujo de votacion de sus elecciones |
| Jurado | Proyectos asignados, criterios y calificaciones |
| Administrador | Configuracion de su organizacion segun permisos |
| Comision electoral | Gestion, certificacion y publicacion de su organizacion |
| Superusuario | Operaciones globales excepcionales y auditadas |

## Endpoints existentes que consume el panel

### Sesion

- `POST /api/auth/login`
- `POST /api/auth/totp/login-verify`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/2fa/status`
- `POST /api/auth/totp/setup`
- `POST /api/auth/totp/verify`
- `POST /api/auth/totp/disable`

### Catalogos y proceso electoral

- `GET /api/organizations`
- `GET /api/academic/faculties`
- `GET /api/academic/programs`
- `GET /api/academic/periods`
- Rutas de elecciones bajo `/api/elections`
- Rutas de cargos bajo `/api/elections/:electionId/positions`
- Rutas de listas bajo `/api/elections/:electionId/candidate-lists`
- Rutas de candidaturas bajo `/api/elections/:electionId/candidacies`
- Rutas de papeletas bajo `/api/ballots`

### Jurado y resultados

- `POST /api/elections/:id/ratings/:candidacyId`
- `GET /api/elections/:id/ratings`
- `GET /api/elections/:id/ratings/results`
- `POST /api/elections/:id/tally/recalculate`
- `GET /api/elections/:id/tally`
- `POST /api/elections/:id/certify`
- `POST /api/elections/:id/publish`
- `GET /api/results/live?election_id=<id>`
- `GET /api/results/final?election_id=<id>`

### Publico

- `GET /api/public/verify-receipt/:receiptCode`

## Flujo operativo administrativo

1. **Preparar organizacion:** crear o aprobar organizacion, definir responsables y politicas.
2. **Preparar padron:** importar estudiantes/docentes, validar identidad y elegibilidad.
3. **Crear eleccion:** definir periodo, cargos, reglas, quorums, fechas y responsables.
4. **Registrar candidaturas:** cargar listas, proyectos, documentos y objetivos.
5. **Resolver tachas:** registrar tacha, evidencia, resolucion y actor. Una tacha FUNDADA debe disparar regeneracion transaccional de papeleta.
6. **Asignar jurados:** asignar por eleccion/proyecto, bloquear conflictos y exigir confirmacion.
7. **Abrir evaluacion:** publicar solo los proyectos y criterios autorizados.
8. **Cerrar evaluacion:** bloquear cambios, recalcular ponderaciones y conservar trazabilidad.
9. **Votar:** validar elegibilidad, crear sesion, emitir voto, registrar integridad y entregar recibo.
10. **Certificar:** comprobar quorums, reglas, acta, doble control y auditoria.
11. **Publicar:** hacer visible el resultado final inmutable para el alcance autorizado.
12. **Auditar y archivar:** exportar acta, evidencia, logs y respaldo de base de datos.

## Reglas de negocio no negociables

- Demo y produccion usan bases, credenciales y secretos separados.
- El frontend oculta opciones, pero el backend siempre valida rol, organizacion, estado y ventana temporal.
- No se permite calificar el propio proyecto ni un proyecto con conflicto declarado.
- No se puede modificar una calificacion despues del cierre sin reapertura formal y auditoria.
- No se certifica una eleccion con quorums o actas incompletas.
- Las tachas FUNDADA, cambios de padron y regeneraciones deben ser idempotentes.
- Los resultados publicados no se sobrescriben: las correcciones crean una nueva version.

## Checklist del panel

- [ ] Mostrar organizacion y eleccion activa.
- [ ] Mostrar rol efectivo y permisos.
- [ ] Mostrar estado de MFA sin exponer secretos.
- [ ] Mostrar bloqueos y motivos de cada accion.
- [ ] Confirmar acciones destructivas y registrar motivo.
- [ ] Mostrar request id en errores para soporte.
- [ ] No guardar access tokens en texto plano; usar almacenamiento seguro del dispositivo.

