// Mirrors the Vite React+TS template, augmented for the test files
// under src/ so vitest's globals are recognized.
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules', '.yarn'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
  overrides: [
    {
      // Vitest's globals API is opt-in via vitest.config.ts; declare them
      // here so ESLint doesn't flag them as undefined. Also disable the
      // fast-refresh rule — it's a dev-server concern that doesn't apply
      // to test helpers/specs.
      files: ['**/*.test.{ts,tsx}', 'src/test/**'],
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
      rules: {
        'react-refresh/only-export-components': 'off',
      },
    },
    {
      // Build config files run under Node, not the browser.
      files: ['vite.config.ts', 'vitest.config.ts'],
      env: { node: true },
    },
  ],
};
