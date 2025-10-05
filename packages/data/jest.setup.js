// Jest setup file for @perfect-task-app/data package
require('@testing-library/jest-dom');

// Set up environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ewuhxqbfwbenkhnkzokp.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dWh4cWJmd2Jlbmtobmt6b2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NTAzMjIsImV4cCI6MjA3NDAyNjMyMn0.2UiFSCR2dUumXQMo2qSkqJBVPTOjx0BphdcZWZEqea8';

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