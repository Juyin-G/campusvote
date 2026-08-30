import pluginSecurity from 'eslint-plugin-security';
import pluginSonarjs from 'eslint-plugin-sonarjs';

export default [
  // Carpetas generadas: no son código fuente del proyecto.
  // Alineado con .gitignore para que lint y git ignoren lo mismo.
  {
    ignores: ['coverage/**', 'dist/**', 'build/**', 'logs/**'],
  },

  pluginSecurity.configs.recommended,
  pluginSonarjs.configs.recommended,

  {
    rules: {
      // Calidad de código
      'no-debugger': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-console': 'off',

      // SonarJS
      'sonarjs/todo-tag': 'warn',
      'sonarjs/cognitive-complexity': ['error', 35],
      'sonarjs/no-hardcoded-passwords': 'off',

      // Security
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-regexp': 'warn',

      // No aplica a API REST
      'sonarjs/content-security-policy': 'off',
    },
  },

  {
    files: ['scripts/**/*.js', 'tests/**/*.js', '**/*.test.js', '**/*.spec.js'],
    rules: {
      'no-console': 'off',
      'sonarjs/no-hardcoded-passwords': 'off',
      'security/detect-non-literal-fs-filename': 'off',
    },
  },

  // Los tests de seguridad (.security.test.js) usan deliberadamente secretos
  // débiles/conocidos y tokens forjados con claves inseguras para VERIFICAR
  // que la aplicación los rechaza. Esos valores son intencionales y no deben
  // considerarse fugas reales de secretos.
  {
    files: ['**/*.security.test.js'],
    rules: {
      'sonarjs/hardcoded-secret-signatures': 'off',
      'sonarjs/insecure-jwt-token': 'off',
    },
  },
];