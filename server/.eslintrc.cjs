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
    'semi': ['error', 'always'],
    'quotes': ['error', 'single'],
    'indent': ['error', 2]
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