# Revision senior de implementacion F0-F9

Fecha de revision: 2026-09-05

## Veredicto ejecutivo

La base del backend es razonable para un MVP serio: Express, PostgreSQL, Prisma, validacion, JWT, refresh tokens, TOTP, auditoria, aislamiento por organizacion y pruebas automatizadas. No debe declararse aun como sistema electoral listo para produccion sin cerrar los puntos de seguridad y operacion indicados en este documento.

El punto principal sobre OTP es el siguiente:

- **Google OAuth** (`/api/auth/google`) autentica con una cuenta Google. No reemplaza un segundo factor.
- **Google Authenticator** usa **TOTP**. En este proyecto ya existe en `/api/auth/totp/setup`, `/api/auth/totp/verify` y en el segundo paso del login.
- **OTP por SMS** es otro mecanismo distinto y debe implementarse detras de un proveedor real. No se debe confundir con TOTP.

## Lo que ya existe y esta bien encaminado

1. Login local con password, bloqueo por intentos y token temporal `TOTP_PENDING`.
2. TOTP de 6 digitos con ventana de tolerancia de un intervalo.
3. Codigos de respaldo almacenados como hashes y consumo individual.
4. Refresh tokens persistidos como hashes.
5. Restriccion de tokens pendientes para evitar saltarse MFA.
6. Roles de jurado, comision electoral, administrador y superusuario.
7. Calificacion de proyectos en `/api/elections/:id/ratings/:candidacyId`.
8. Votacion con sesiones y comprobante publico en `/api/public/verify-receipt/:receiptCode`.
9. Certificacion, publicacion y resultados protegidos por organizacion.

## Bloqueos antes de produccion

### P0 - Corregir antes de exponer el sistema

- **OAuth state no se valida.** El callback genera `state`, pero no lo guarda en una sesion/cookie segura ni compara el `state` recibido. Esto deja el flujo expuesto a login CSRF. La solucion debe usar `state` de un solo uso, expiracion corta, cookie `HttpOnly`, `Secure`, `SameSite=Lax` y validacion estricta.
- **Tokens en query string.** `/api/auth/google/callback` redirige con `token` y `refreshToken` en la URL. Las URL quedan en historial, logs, analytics y encabezados Referer. Entregar un codigo de canje de un solo uso o cookies seguras; nunca ambos tokens en la URL.
- **Secreto TOTP en claro.** `two_factor_secret` se persiste directamente. Debe cifrarse con una clave de secretos gestionada, con rotacion y versionado. El QR y el secreto solo se muestran una vez durante el enrolamiento.
- **Consumo concurrente de backup code.** La lectura, eliminacion y escritura del arreglo debe ser atomica o usar una transaccion con control de concurrencia. Dos solicitudes simultaneas no deben poder consumir el mismo codigo.

### P1 - Cerrar antes de una eleccion real

- Rate limit especifico por `userId + electionId`, ademas del limite por IP.
- Limite independiente para TOTP, backup codes y endpoints de setup/disable.
- Auditoria de enrolamiento, activacion, desactivacion, intento fallido, consumo de backup code, login Google y cambio de rol.
- Rotacion de refresh token en cada refresh, revocacion por reutilizacion y asociacion a dispositivo.
- Confirmar que todas las operaciones de tachas FUNDADA regeneren papeletas de forma transaccional y auditable.
- Ejecutar migraciones SQL y la suite de integracion contra PostgreSQL local limpio.
- Pruebas de recuperacion, backup, restauracion y observabilidad en un entorno parecido a produccion.

## Flujo TOTP recomendado

1. Usuario autenticado solicita `POST /api/auth/totp/setup`.
2. Backend genera un secreto temporal cifrado y devuelve una URI `otpauth` una sola vez.
3. La app muestra QR o ingreso manual y el usuario lo registra en Google Authenticator.
4. Usuario envia `POST /api/auth/totp/verify` con el codigo actual.
5. Backend valida el codigo, activa 2FA y devuelve los codigos de respaldo una sola vez.
6. En login, `POST /api/auth/login` devuelve `requiresTotp=true` y `tempToken` de cinco minutos.
7. La app envia `POST /api/auth/totp/login-verify` con `Authorization: Bearer <tempToken>`.
8. Solo despues de validar TOTP o backup code se entregan access y refresh token.

El frontend nunca debe tratar `tempToken` como una sesion normal ni almacenarlo como refresh token.

## Criterios de aceptacion para declarar produccion

- No hay secretos ni tokens en logs, URL, respuestas de error o analytics.
- Cada accion administrativa importante deja actor, organizacion, eleccion, motivo, IP, user-agent, timestamp y request id.
- Pruebas de autorizacion confirman que un usuario de una organizacion no puede operar sobre otra.
- Una eleccion publicada es inmutable salvo un procedimiento formal de correccion.
- Certificacion requiere quorums configurados, doble control cuando la politica lo exija y evidencia descargable.
- Existe runbook de incidentes, restauracion y revocacion de credenciales.

## Estado de Flutter

No se encontraron fuentes Flutter en este repositorio. Por tanto, este backend no puede validar aun la implementacion real de pantallas, almacenamiento seguro, deep links ni manejo de estados de la app. El contrato recomendado esta en `FLUJO_FLUTTER_JURADO_VOTACION.md`.

