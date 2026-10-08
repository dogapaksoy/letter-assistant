// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'coverage/*', 'eval/results/*', 'supabase/functions/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // CLAUDE.md: no `any` without a comment explaining why (use an eslint-disable comment with a reason).
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  // Must stay last: turns off rules that conflict with Prettier.
  prettierConfig,
]);
