# Guia Firebase para Web, Flutter e iOS

## Arquitectura elegida

Firebase solo identifica al estudiante con Google. CampusVote sigue siendo la
autoridad de usuarios, roles, padron, MFA, elecciones y sesiones.

```text
Web / Flutter / iOS
        |
        | Firebase Google Sign-In
        v
Firebase ID token
        |
        | POST /api/auth/firebase/verify
        v
CampusVote verifica el token, busca el email institucional
y emite sus propios access/refresh tokens.
        |
        | Si tiene MFA
        v
Google Authenticator / TOTP
```

Firebase no reemplaza Google Authenticator. Son capas distintas:

- Firebase: login con cuenta Google.
- TOTP: segundo factor de CampusVote.

## 1. Crear y configurar Firebase

1. Entrar a Firebase Console y crear/seleccionar el proyecto.
2. En **Authentication -> Sign-in method**, activar **Google**.
3. En **Authentication -> Settings -> Authorized domains**, agregar:
   - `localhost` para desarrollo web;
   - dominio del frontend de staging;
   - dominio final de producción.
4. En **Project settings -> General**, registrar las aplicaciones:
   - Web app para el panel administrativo;
   - Android/iOS desde Flutter cuando existan sus identificadores.
5. No activar proveedores adicionales si no son necesarios.

## 2. Crear credenciales del backend

En Firebase Console:

1. **Project settings -> Service accounts**.
2. Seleccionar **Generate new private key**.
3. Guardar el JSON fuera del repositorio.
4. En Render configurar:

```text
FIREBASE_PROJECT_ID=valor project_id del JSON
FIREBASE_CLIENT_EMAIL=valor client_email del JSON
FIREBASE_PRIVATE_KEY=valor private_key del JSON
```

No subir el JSON a GitHub, Flutter, Web, iOS ni archivos `.env` versionados.
En `FIREBASE_PRIVATE_KEY`, Render puede recibir el contenido con `\n`; el
backend lo normaliza.

## 3. Backend CampusVote

El endpoint disponible es:

```text
POST /api/auth/firebase/verify
Content-Type: application/json
```

Request:

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

Respuesta sin TOTP:

```json
{
  "success": true,
  "data": {
    "requiresTotp": false,
    "token": "campusvote-access-token",
    "refreshToken": "campusvote-refresh-token",
    "user": {}
  }
}
```

Respuesta con TOTP:

```json
{
  "success": true,
  "data": {
    "requiresTotp": true,
    "tempToken": "token-temporal",
    "mustChangePassword": false
  }
}
```

Para completar MFA:

```text
POST /api/auth/totp/login-verify
Authorization: Bearer <tempToken>
```

El backend:

1. verifica firma, proyecto, expiracion y revocacion del ID token;
2. exige correo verificado;
3. exige proveedor `google.com`;
4. busca un usuario CampusVote existente por Firebase UID o email;
5. rechaza cuentas no registradas, inactivas o no verificadas;
6. emite tokens propios de CampusVote;
7. exige TOTP si la cuenta lo tiene activado.

No se crean usuarios automaticamente. El administrador debe registrar primero
al estudiante y asociarlo a su organizacion/programa/padron.

## 4. Web administrativo

Instalar Firebase en el proyecto frontend:

```bash
npm install firebase
```

Configurar variables publicas del frontend. Estas no son secretos:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_API_URL=https://campusvote-api-staging.onrender.com
```

Para tu proyecto actual, el valor conocido es:

```env
VITE_FIREBASE_PROJECT_ID=campusvote-382ef
VITE_FIREBASE_MESSAGING_SENDER_ID=570935463059
```

`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID` y `VITE_FIREBASE_STORAGE_BUCKET`
deben copiarse desde la configuración de la app Web en Firebase Console; no se
pueden deducir de los datos del proyecto.

Inicializar Firebase:

```js
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const firebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const firebaseAuth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
```

Login:

```js
import { signInWithPopup } from 'firebase/auth';
import { firebaseAuth, googleProvider } from './firebase';

const credential = await signInWithPopup(firebaseAuth, googleProvider);
const idToken = await credential.user.getIdToken(true);

const response = await fetch(`${API_URL}/api/auth/firebase/verify`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idToken }),
});

const result = await response.json();
```

Reglas del frontend:

- Si `requiresTotp=false`, guardar la sesion CampusVote en almacenamiento
  seguro o cookie segura.
- Si `requiresTotp=true`, conservar `tempToken` solo en memoria y mostrar MFA.
- No usar el Firebase ID token como `Authorization` para endpoints CampusVote.
- No guardar tokens en `localStorage` si el modelo de seguridad exige mayor
  proteccion; preferir cookies `HttpOnly` o una estrategia de memoria/refresh.
- Configurar Firebase Authorized Domains para cada ambiente.

## 5. Flutter Android

Instalar FlutterFire CLI y configurar el proyecto:

```bash
dart pub global activate flutterfire_cli
flutterfire configure
```

Seleccionar el proyecto Firebase y las plataformas Android, iOS y web.

Dependencias:

```yaml
dependencies:
  firebase_core: ^3.0.0
  firebase_auth: ^5.0.0
  google_sign_in: ^6.0.0
  flutter_secure_storage: ^9.0.0
```

Inicializacion:

```dart
await Firebase.initializeApp(
  options: DefaultFirebaseOptions.currentPlatform,
);
```

Login Google:

```dart
final googleUser = await GoogleSignIn().signIn();
if (googleUser == null) return;

final googleAuth = await googleUser.authentication;
final credential = GoogleAuthProvider.credential(
  accessToken: googleAuth.accessToken,
  idToken: googleAuth.idToken,
);

await FirebaseAuth.instance.signInWithCredential(credential);
final idToken = await FirebaseAuth.instance.currentUser!.getIdToken(true);
```

Enviar `idToken` a `/api/auth/firebase/verify`. Guardar solo los tokens
CampusVote en `flutter_secure_storage`.

## 6. Flutter iOS

1. Ejecutar `flutterfire configure` seleccionando iOS.
2. Agregar `GoogleService-Info.plist` al target Runner en Xcode.
3. Verificar que el Bundle ID coincida con Firebase.
4. Configurar el URL scheme de Google Sign-In indicado por
   `GoogleService-Info.plist` en Xcode.
5. Abrir `ios/Runner.xcworkspace`, no el `.xcodeproj`.
6. Probar en un dispositivo o simulador con una cuenta Google de prueba.

Firebase Auth para Google en iOS no requiere APNs; APNs solo es necesario para
notificaciones push. Si mas adelante se activa Firebase Messaging, se debe
configurar APNs por separado.

## 7. Registro institucional y prueba de 100 estudiantes

Antes del login Google:

1. Crear estudiantes en CampusVote con email institucional.
2. Asociar organizacion, facultad/programa y padron.
3. Marcar la cuenta activa/verificada por el flujo administrativo.
4. Probar que un email Google no registrado recibe `403`.
5. Probar que un email personal no autorizado no entra.
6. Probar login Google de 100 cuentas ficticias o de prueba autorizadas.
7. Activar TOTP para administradores y jurados.
8. Probar jurado, revision de proyectos, rating y votacion con datos sinteticos.

## 8. Variables de Render

Backend:

```text
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

Frontend Static Site:

```text
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_API_URL=...
```

Las variables `VITE_*` son visibles en el navegador. Nunca deben contener la
private key de Firebase Admin ni secretos del backend.
