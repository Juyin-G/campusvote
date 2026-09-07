# Flujo Flutter: votacion, jurado y verificacion de proyectos

## Alcance

Este documento define el contrato de una app Flutter para elector y jurado. No hay codigo Flutter en el repositorio actual; los nombres de pantallas y servicios son una propuesta de integracion que debe probarse contra el backend real.

## Arquitectura movil recomendada

- `ApiClient`: HTTP, timeout, serializacion y request id.
- `AuthRepository`: login, TOTP, refresh, logout y perfil.
- `SecureSessionStore`: access/refresh token en `flutter_secure_storage`.
- `ElectionRepository`: elecciones, papeletas y estado de elegibilidad.
- `VotingRepository`: sesiones, emision y recibo.
- `JuryRepository`: proyectos, criterios y ratings.
- `Audit/Telemetry`: errores tecnicos sin incluir tokens, secretos ni votos.
- Interceptor HTTP: ante 401 intenta un refresh una sola vez; si falla, cierra sesion.

## Login y Google Authenticator

1. `POST /api/auth/login` con email y password.
2. Si `requiresTotp=false`, guardar la sesion de forma segura.
3. Si `requiresTotp=true`, no abrir el home. Guardar `tempToken` solo en memoria.
4. Mostrar pantalla de codigo TOTP y enviar `POST /api/auth/totp/login-verify` con el temp token.
5. Enviar `code` de seis digitos o `backupCode` de ocho caracteres.
6. Guardar los tokens definitivos y eliminar el temp token.

Para enrolamiento:

1. `POST /api/auth/totp/setup`.
2. Mostrar QR desde la URI `otpauth` sin persistir el secreto en logs.
3. Pedir el codigo generado por Google Authenticator.
4. `POST /api/auth/totp/verify`.
5. Mostrar codigos de respaldo una sola vez y exigir confirmacion de guardado.

Google OAuth (`/api/auth/google`) es un login alternativo, no el segundo factor TOTP.

## Flujo del elector

1. Consultar elecciones disponibles y estado de elegibilidad.
2. Abrir detalle de eleccion y verificar fecha, organizacion, cargos y reglas.
3. Iniciar `POST /api/voting/elections/:electionId/sessions`.
4. Renderizar la papeleta devuelta por el backend; no construir opciones desde datos locales.
5. Validar en UI y volver a validar en servidor.
6. Enviar `POST /api/voting/sessions/:sessionId/cast`.
7. Mostrar confirmacion y recibo, sin mostrar el voto secreto en el comprobante.
8. Permitir verificacion publica con `GET /api/public/verify-receipt/:receiptCode`.

La app debe evitar doble envio, soportar reintentos idempotentes y mostrar claramente si una sesion expiro.

## Flujo del jurado

1. Login y MFA completados.
2. Consultar elecciones/proyectos asignados.
3. Antes de calificar, el backend debe confirmar asignacion, ventana abierta y ausencia de conflicto.
4. Abrir el proyecto y sus documentos permitidos.
5. Mostrar criterios, ponderaciones y escala.
6. Enviar `POST /api/elections/:id/ratings/:candidacyId` con score y detalle requerido por el schema.
7. Mostrar confirmacion con timestamp y estado de sincronizacion.
8. Consultar:
   - `GET /api/elections/:id/ratings`
   - `GET /api/elections/:id/ratings/results`
9. Al cerrar la ventana, cambiar la app a solo lectura.

El jurado no debe ver calificaciones de otros jurados si la politica exige independencia. Si se muestran promedios, deben provenir del backend y respetar el estado de publicacion.

## Switch de revision de proyectos

El **switch** es el acceso visual al modulo **Revision de proyectos**. No cambia el rol del usuario ni concede permisos: solo cambia entre la vista general y la cola de proyectos que el jurado tiene asignados.

Flujo:

1. El jurado activa **Revision de proyectos**.
2. Flutter consulta las asignaciones del jurado para la eleccion activa.
3. La app muestra cada proyecto con titulo, integrantes, documentos permitidos y criterios.
4. El jurado abre un proyecto, lo revisa y selecciona un rating de 1 a 5.
5. Puede agregar un comentario sujeto al limite del backend.
6. La app confirma y envia `POST /api/elections/:id/ratings/:candidacyId`.
7. La tarjeta del proyecto cambia a **Calificado** y muestra fecha/estado de sincronizacion.
8. El jurado pasa al siguiente proyecto desde la cola.

Reglas:

- Solo aparecen proyectos asignados al jurado y dentro de la ventana de evaluacion.
- El backend valida asignacion, conflicto de interes, estado de eleccion y duplicidad.
- El switch no debe mostrar proyectos de otra organizacion ni permitir cambiar `jurorId`.
- Si una calificacion ya fue enviada, la UI la muestra como bloqueada salvo que exista una reapertura formal.
- Si el servidor responde 403 o 409, la app muestra el motivo y actualiza la cola.
- El promedio general solo se muestra cuando la politica de evaluacion lo permita; nunca se usa como fuente para calcular el rating local.

## Pantallas minimas

### Comun

- Splash y comprobacion de sesion.
- Login.
- Verificacion TOTP/backup code.
- Seleccion de organizacion/eleccion.
- Perfil, estado de MFA y cierre de sesion.
- Estados offline, expiracion y reintento.

### Elector

- Elecciones disponibles.
- Detalle y reglas.
- Papeleta.
- Confirmacion antes de emitir.
- Recibo y verificacion publica.

### Jurado

- Mis asignaciones.
- Switch **Revision de proyectos**.
- Detalle de proyecto.
- Criterios y formulario de rating (1-5).
- Conflicto de interes.
- Calificaciones enviadas y estado de cierre.

## Contratos de seguridad movil

- TLS obligatorio y validacion normal de certificado; no aceptar certificados arbitrarios.
- Tokens solo en almacenamiento seguro; nunca en SharedPreferences, logs o analytics.
- Limpiar sesion al cambiar de usuario.
- Bloqueo local opcional con biometria, sin reemplazar MFA del servidor.
- Redactar `Authorization`, passwords, TOTP, backup codes y payload de voto en logs.
- No almacenar votos en cache persistente.
- Mostrar version de la app y request id para soporte.

## Pruebas de aceptacion

- Login sin MFA, login con TOTP correcto, TOTP incorrecto y backup code consumido.
- Refresh concurrente y expiracion de sesion.
- Elector inelegible, eleccion cerrada y doble envio.
- Jurado sin asignacion, conflicto, criterio incompleto y cierre de evaluacion.
- Perdida de red antes y despues de emitir voto.
- Cambio de contexto con permisos insuficientes.
- Verificacion publica de recibo valido, invalido y ya revocado.
