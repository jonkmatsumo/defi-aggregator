export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/testSetup.js'],
  testTimeout: 10000,
  detectOpenHandles: true,
  forceExit: true,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.(js)$': '$1'
  }
};