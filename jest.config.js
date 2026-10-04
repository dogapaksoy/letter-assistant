/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      // Pure logic (parsing, verification, adapters): no React Native runtime needed.
      displayName: 'core',
      preset: 'jest-expo',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/core/**/*.test.ts'],
    },
    {
      displayName: 'app',
      preset: 'jest-expo',
      // Tests must not live in src/app/: Expo Router would treat them as routes.
      testMatch: ['<rootDir>/src/**/*.test.tsx'],
      testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/app/'],
    },
  ],
};
