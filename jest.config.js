/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      // Non-UI logic (.ts tests: parsing, verification, config): no React Native runtime needed.
      displayName: 'logic',
      preset: 'jest-expo',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/scripts/**/*.test.ts'],
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
