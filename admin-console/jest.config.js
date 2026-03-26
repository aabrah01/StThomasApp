/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs' } }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Stub Next.js cookie / header internals (requireAdmin is mocked in API tests)
    '^next/headers$': '<rootDir>/__mocks__/next/headers.ts',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
};
