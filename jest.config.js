/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  // Use babel-jest with the expo preset to handle JSX / ES modules
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  // Modules that ship as ES modules need to be transformed
  transformIgnorePatterns: [
    'node_modules/(?!(@supabase|expo|@expo|react-native|@react-native)/)',
  ],
  // Mock modules that require native device APIs
  moduleNameMapper: {
    '^../../supabase\\.config$': '<rootDir>/__mocks__/supabase.config.js',
  },
  testMatch: ['**/src/__tests__/**/*.test.js'],
};
