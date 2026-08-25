/**
 * @file setup-security-tests.js
 * @description Setup mínimo para tests de seguridad que no requieren base de datos
 */

export default async function setupSecurityTests() {
  // Configurar variables de entorno mínimas para tests de seguridad
  // Estos tests verifican la validación de JWT_SECRET, por lo que
  // cada test configurará su propio JWT_SECRET según lo que necesite probar
  
  console.log('Setup de tests de seguridad completado (sin base de datos)');
}
