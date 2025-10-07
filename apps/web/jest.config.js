module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>'],
  testMatch: [
    '**/__tests__/**/*.test.{js,jsx,ts,tsx}',
    '**/*.test.{js,jsx,ts,tsx}'
  ],
  moduleNameMapper: {
    // Handle module aliases from tsconfig
    '^@/(.*)$': '<rootDir>/$1',
    '^@perfect-task-app/models$': '<rootDir>/../../packages/models/index.ts',
    '^@perfect-task-app/data$': '<rootDir>/../../packages/data/index.ts',
    '^@perfect-task-app/ui/(.*)$': '<rootDir>/../../packages/ui/$1',
    '^@perfect-task-app/ui$': '<rootDir>/../../packages/ui/index.ts',
    // Handle CSS imports (Next.js)
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
      },
    }],
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 10000,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  collectCoverageFrom: [
    'components/**/*.{js,jsx,ts,tsx}',
    'app/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
  ],
};
