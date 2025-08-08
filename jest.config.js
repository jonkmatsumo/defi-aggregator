module.exports = {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  
  // Test file patterns
  testMatch: [
    '<rootDir>/tst/**/*.test.{js,jsx}',
    '<rootDir>/tst/**/*.spec.{js,jsx}',
    '<rootDir>/src/**/*.test.{js,jsx}',
    '<rootDir>/src/**/*.spec.{js,jsx}'
  ],
  
  // Module name mapping for cleaner imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tst/(.*)$': '<rootDir>/tst/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  
  // Transform files
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  
  // Transform ignore patterns to handle ES modules
  transformIgnorePatterns: [
    'node_modules/(?!(wagmi|@wagmi|@rainbow-me|viem|@viem|cuer|@cuer)/)'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/index.js',
    '!src/setupTests.js'
  ],
  
  // Coverage directory
  coverageDirectory: 'coverage',
  
  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Test timeout
  testTimeout: 10000,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Verbose output
  verbose: true,
}; 