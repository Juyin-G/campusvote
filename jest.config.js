export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(@apidevtools|swagger-jsdoc)/)'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/**',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 30000,
  globalSetup: '<rootDir>/tests/setup-db.js',
  forceExit: true,
  detectOpenHandles: true
};