module.exports = {
  extends: [
    'react-app',
    'react-app/jest'
  ],
  globals: {
    BigInt: 'readonly'
  },
  rules: {
    // Allow console.log in tests and development
    'no-console': 'off',
    // Allow BigInt prototype extension in test files
    'no-extend-native': 'off'
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/*.test.jsx', 'tst/**/*.js', 'tst/**/*.jsx'],
      rules: {
        // Relax some testing library rules that are overly pedantic
        'testing-library/no-unnecessary-act': 'warn',
        'testing-library/no-wait-for-multiple-assertions': 'warn',
        'testing-library/no-wait-for-side-effects': 'warn',
        'testing-library/no-node-access': 'warn',
        'testing-library/prefer-presence-queries': 'warn'
      }
    }
  ]
};