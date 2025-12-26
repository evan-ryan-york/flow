module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/services', '<rootDir>/hooks', '<rootDir>/__tests__', '<rootDir>/../ui/components'],
  testMatch: [
    '**/__tests__/**/*.test.{js,jsx,ts,tsx}',
    '**/*.test.{js,jsx,ts,tsx}'
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@flow-app/models$': '<rootDir>/../models/index.ts',
    '^@flow-app/data$': '<rootDir>/index.ts',
    '^react$': '<rootDir>/../../node_modules/react',
    '^react-dom$': '<rootDir>/../../node_modules/react-dom',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 30000, // 30 seconds for integration tests
  testPathIgnorePatterns: [
    '/node_modules/',
    'rls\\.test',
    'integration\\.test',
    'simple\\.test',
    'services/customPropertyService\\.test',
    'services/googleAuthService\\.test',
    'services/projectService\\.test\\.ts',
    'services/timeBlockService\\.test',
    'services/viewService\\.test'
  ],
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react-jsx',
      },
    },
  },
};