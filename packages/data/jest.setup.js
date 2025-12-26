// Jest setup file for @flow-app/data package
require('@testing-library/jest-dom');

// Validate required environment variables for tests
// These must be set in your environment or .env.local file
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.warn('Warning: NEXT_PUBLIC_SUPABASE_URL not set. Tests requiring Supabase will fail.');
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn('Warning: NEXT_PUBLIC_SUPABASE_ANON_KEY not set. Tests requiring Supabase will fail.');
}

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