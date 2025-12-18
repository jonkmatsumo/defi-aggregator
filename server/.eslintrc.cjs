module.exports = {
  env: {
    es2022: true,
    node: true,
    jest: true
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'no-console': 'warn',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'prefer-const': 'error',
    'no-var': 'error',
    'semi': 'off', // Handled by Prettier
    'quotes': 'off', // Handled by Prettier
    'indent': 'off' // Handled by Prettier
  },
  ignorePatterns: [
    'node_modules/',
    'coverage/',
    'dist/'
  ],
  overrides: [
    {
      files: ['tests/**/*.js', '**/*.test.js'],
      plugins: ['jest'],
      rules: {
        'jest/no-conditional-expect': 'off'
      }
    }
  ]
};