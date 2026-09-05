# Auditoria completa de produccion y logica de negocio

Fecha: 2026-09-05  
Alcance: backend Node/Express, PostgreSQL/SQL, Prisma, autenticacion, votacion, rating de proyectos, auditoria, documentacion y despliegue en Render.

## Veredicto

**NO esta listo para una eleccion real ni para declararlo produccion.**

Si esta listo para el siguiente paso controlado: desplegar un entorno **staging/QA** en Render, cargar datos sinteticos y comenzar el frontend administrativo. No se debe usar aun para votos o evaluaciones oficiales.

### Validaciones ejecutadas

| Validacion | Resultado |
|---|---|
| `npm install` | OK; reporta 4 vulnerabilidades de dependencias de produccion |
| `npm run lint` | OK |
| `npm run db:generate` | OK |
| `npx prisma validate` | BLOQUEADO: falta `DATABASE_URL` |
| `npm test -- --runInBand` | BLOQUEADO: falta `.env.test`/PostgreSQL |
| Migraciones SQL contra PostgreSQL limpio | NO ejecutadas en este entorno |

El archivo `test-output.txt` no reemplaza una ejecucion actual: la suite debe correrse contra una base PostgreSQL limpia y real.

## Bloqueadores P0

### 1. Rating de proyectos no tiene asignacion ni conflicto de interes

`ratings` solo guarda `election_id`, `candidacy_id` y `juror_id`. No existe una tabla o servicio que demuestre que ese jurado fue asignado al proyecto, ni una regla que impida autoevaluacion o conflicto.

Aunque la documentacion dice que el backend valida asignacion y conflicto, `rating.service.js` solo valida organizacion, tipo/estado de eleccion y pertenencia de la candidatura. Un usuario con rol permitido podria calificar cualquier proyecto de su organizacion.

**Debe existir antes de produccion:**

- `jury_assignments` o equivalente, con eleccion, jurado, proyecto/candidatura, estado y timestamps.
- declaracion y resolucion de conflicto.
- consulta de asignacion obligatoria en `rateProject`.
- prohibicion de calificar proyectos propios o relacionados.
- auditoria de asignacion, aceptacion, conflicto, rating y reapertura.

### 2. El rating es editable aunque la politica dice una sola entrega

`upsertRating` actualiza `score` y `comment` cuando ya existe el registro. Eso permite cambiar una calificacion sin reapertura formal y sin versionado.

Decidir explicitamente una politica:

- **Inmutable:** segundo envio devuelve `409`; una reapertura crea una nueva version auditada.
- **Editable:** solo durante la ventana abierta, con historial completo y motivo obligatorio.

Para una evaluacion competitiva se recomienda la primera.

### 3. OAuth Google tiene dos riesgos de produccion

- Se genera `state` pero no se persiste ni se valida en el callback.
- Se envian access y refresh tokens en la URL de redireccion.

Debe usarse state de un solo uso, cookie segura o almacenamiento temporal, y un codigo de canje de un solo uso. Nunca tokens en query string.

### 4. Secreto TOTP sin cifrado

`two_factor_secret` se guarda directamente. Google Authenticator/TOTP esta implementado, pero el secreto debe cifrarse en reposo con una clave de secretos gestionada y rotacion.

### 5. Backup codes no se consumen atomicamente

La lectura, eliminacion del indice y escritura del JSON ocurren en pasos separados. Dos solicitudes concurrentes pueden consumir el mismo codigo. Usar transaccion/actualizacion condicional o una tabla normalizada de backup codes con `consumed_at`.

### 6. Subida de archivos no es apta para Render

Los archivos se guardan en `public/uploads` del disco local y Render usa filesystem efimero. Ademas, `upload.routes.js` usa `req.user.id`, mientras el JWT emite `userId`; la subida puede fallar al guardar el propietario.

Usar almacenamiento persistente externo (S3/R2/GCS/Firebase Storage si se decide) y normalizar el actor a `req.user.userId`.

## Riesgos P1 de negocio y seguridad

| Area | Estado actual | Accion |
|---|---|---|
| Tachas FUNDADA | No queda demostrado un flujo transaccional de regeneracion de papeleta | Implementar version nueva de ballot, invalidar la anterior y auditar |
| Token de acceso de votacion | El propio documento de produccion indica que su consumo estuvo incompleto | Probar end-to-end inicio de sesion, consumo unico y voto |
| Rate limit | Predominantemente por IP | Añadir limites por usuario, eleccion, TOTP y jurado |
| Auditoria | Existe infraestructura, pero las nuevas acciones no estan cubiertas completamente | Ampliar enum/acciones y probar evidencia inmutable |
| Refresh token | Se persiste hash, pero falta confirmar rotacion y deteccion de reutilizacion | Implementar rotacion por refresh y revocacion por reuse |
| Notificaciones | Rating intenta notificar y no rompe la operacion si falla | Separar outbox/worker; no esconder fallos operativos en produccion |
| Resultados | Hay tally/certificacion/publicacion | Probar inmutabilidad, quorum, doble control y versionado de correcciones |
| Exportaciones | Existen PDF/CSV/XLSX | Ejecutar pruebas de formula injection y control de acceso |
| Backups | Scheduler local opcional | No confiar en disco efimero de Render; usar backup gestionado |
| Dependencias | `npm audit --omit=dev`: 1 alta y 3 moderadas | Actualizar y probar antes de produccion |

## Revision por dominio

### Autenticacion e identidad

La estructura es buena: password, bloqueo, email, refresh token y TOTP. Google OAuth es opcional y puede permanecer deshabilitado durante el piloto de 100 personas. Falta endurecer TOTP y probar configuracion real de SMTP. Firebase tampoco es necesario para ese piloto.

### Organizaciones y multi-tenancy

Hay validaciones de organizacion en elecciones, rating y resultados. Debe probarse cada endpoint de lectura y escritura con dos organizaciones. `optionalAuthenticate` actualmente es un middleware que no autentica; el nombre puede inducir a error y debe renombrarse a `publicAccess` o implementar autenticacion opcional real.

### Padron academico

Hay tablas, funciones SIS y validacion de elegibilidad. Falta ejecutar migraciones limpias, cargar datos representativos y probar cambios de periodo, bajas, reclamos y sincronizaciones parciales.

### Elecciones, candidaturas y tachas

Existe el ciclo de eleccion, cargos, listas, candidaturas, reglas y desafios. La regeneracion de papeletas por tacha FUNDADA es un requisito pendiente critico: no publicar hasta demostrar que la papeleta vigente coincide con el estado final de candidaturas.

### Papeletas y votacion

Existe sesion, voto, integridad, escrutinio y comprobante publico. Falta una prueba de negocio completa: elegibilidad -> una sola sesion -> voto cifrado -> no doble voto -> tally -> certificacion -> publicacion -> verificacion del recibo.

### Jurado y evaluacion

El endpoint de rating existe y limita el score a 1-5, pero el dominio aun es incompleto por falta de asignacion, conflicto y politica de inmutabilidad. Este es el mayor bloqueo para el flujo de revision de proyectos.

### Resultados y certificacion

La estructura de certificacion y quorum existe, con proteccion de organizacion. Debe verificarse con datos reales de borde: cero votos, empate, quorum exacto, quorum no alcanzado, repeticion de certificacion y correccion posterior.

## Nombres obsoletos o inconsistentes

No se debe borrar automaticamente porque algunos paths son historicos o funcionales, pero deben limpiarse:

- `DOCUMENTACION_BACKEND_TECVOTE.md`: nombre heredado; debe llamarse CampusVote.
- Referencias a `voter_registry` y `organization-request`: el codigo usa esos directorios, pero la documentacion los describe como modulos eliminados.
- `optionalAuthenticate`: no autentica; renombrar o implementar correctamente.
- `src/server.js`: comentario/import comentado de `config/db.js` y desconexion Prisma comentada.
- `package.json#prisma`: Prisma advierte que esta configuracion es deprecated en favor de `prisma.config.ts`; eliminar la clave duplicada despues de confirmar el flujo.
- `DEPLOY_RENDER.md`: menciona `JWT_REFRESH_SECRET`, pero el codigo usa `JWT_SECRET` para firmar JWT y guarda refresh tokens como hash; revisar y documentar una sola politica.
- `test-output.txt`: resultado historico; no usarlo como evidencia de CI actual.

## Condicion para pasar a produccion

Solo aprobar despues de:

1. PostgreSQL limpio con todas las migraciones aplicadas sin omisiones silenciosas.
2. Suite de integracion completa en esa base.
3. Asignacion/conflictos/inmutabilidad de ratings implementados y probados.
4. OAuth/TOTP y subida de archivos endurecidos.
5. Pruebas de autorizacion multi-organizacion.
6. Secrets, SMTP, Google, backups, monitoring y rollback configurados.
7. Prueba piloto con datos sinteticos y luego eleccion controlada.
