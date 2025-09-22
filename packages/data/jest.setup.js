// Jest setup file for @perfect-task-app/data package

// Mock console.error and console.warn to keep test output clean
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    if (args[0]?.includes && args[0].includes('Warning: ReactDOM.render is deprecated')) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args) => {
    if (args[0]?.includes && args[0].includes('act()')) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Increase timeout for async operations
jest.setTimeout(30000);