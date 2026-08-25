import pluginSecurity from 'eslint-plugin-security';
import pluginSonarjs from 'eslint-plugin-sonarjs';

export default [
  pluginSecurity.configs.recommended,
  pluginSonarjs.configs.recommended,

  {
    rules: {
      // Calidad de código
      'no-debugger': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-console': 'off', // Cambiado a 'off' para permitir logs de winston/consoles

      // SonarJS
      'sonarjs/todo-tag': 'warn',
      'sonarjs/cognitive-complexity': ['error', 35],

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
];