// Jest setup for Next.js web app
require('@testing-library/jest-dom');

// Mock Supabase
jest.mock('@flow-app/data/supabase', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    })),
    auth: {
      getUser: jest.fn(),
      signOut: jest.fn(),
    },
  })),
}));

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    };
  },
  useSearchParams() {
    return new (globalThis.URLSearchParams || URLSearchParams)();
  },
  usePathname() {
    return '/';
  },
}));

// Mock window.scrollTo for jsdom (used by motion-dom/framer-motion)
Object.defineProperty(window, 'scrollTo', {
  value: jest.fn(),
  writable: true,
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Suppress console warnings in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    if (
      args[0]?.includes?.('Warning: ReactDOM.render') ||
      args[0]?.includes?.('Warning: useLayoutEffect') ||
      args[0]?.includes?.('Not implemented: HTMLFormElement.prototype.requestSubmit') ||
      args[0]?.includes?.('Not implemented: window.scrollTo') ||
      args[0]?.message?.includes?.('Not implemented: window.scrollTo') ||
      args[0]?.type === 'not implemented'
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args) => {
    if (
      args[0]?.includes?.('act()') ||
      args[0]?.includes?.('ReactDOMTestUtils.act')
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});
