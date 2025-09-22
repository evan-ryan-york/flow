# @perfect-task-app/data

This package contains the data layer for the Perfect Task App, including services for API communication and React Query hooks for state management.

## Structure

```
packages/data/
├── services/           # Service layer - direct Supabase API communication
│   ├── authService.ts     # Authentication operations
│   └── profileService.ts  # User profile management
├── hooks/              # React Query hooks for UI state management
│   ├── useAuth.ts         # Authentication hooks
│   └── useProfile.ts      # Profile management hooks
├── __tests__/          # Test files
│   ├── services/          # Integration tests for services
│   ├── hooks/             # Unit tests for React hooks
│   └── helpers/           # Test utilities
└── index.ts           # Package exports
```

## Testing

This package follows the testing strategy outlined in `docs/project-wide-context/testing-strategy.md`.

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

### Test Types

1. **Service Integration Tests** (`__tests__/services/`):
   - Test against live local Supabase instance
   - Validate Zod schemas and data shapes
   - Test Row-Level Security (RLS) policies
   - Test CRUD operations and edge cases

2. **Hook Unit Tests** (`__tests__/hooks/`):
   - Test React Query hook behavior in isolation
   - Mock service layer to focus on hook logic
   - Test loading states, error handling, and caching

### Test Setup

- **Jest** configuration in `jest.config.js`
- **Test helpers** in `__tests__/helpers/` for Supabase setup
- **Service mocking** for hook tests to ensure isolation
- **React Query test utilities** for hook testing

### Phase 1 Test Coverage

✅ **authService** - Complete integration test suite:
- Sign up, sign in, sign out operations
- Session management
- Error handling and edge cases
- Database trigger validation (profile + General project creation)

✅ **profileService** - Complete integration test suite:
- Profile fetching and updating
- Zod schema validation
- RLS policy enforcement
- Data integrity and edge cases

✅ **useAuth hooks** - Complete unit test suite:
- useSession, useCurrentUser query hooks
- useSignUp, useSignIn, useSignOut mutation hooks
- Cache invalidation and state management
- Error handling and concurrent requests

✅ **useProfile hooks** - Complete unit test suite:
- useProfile query hook with caching
- useUpdateProfile mutation hook
- Optimistic updates and cache management
- Error handling and data flow

## Dependencies

- `@supabase/supabase-js` - Supabase client
- `@tanstack/react-query` - Server state management
- `@perfect-task-app/models` - Zod schemas and types

## Development Dependencies

- `jest` - Test runner
- `ts-jest` - TypeScript Jest preset
- `@testing-library/react-native` - React hook testing utilities
- `@testing-library/react-hooks` - Hook testing library (legacy)

## Environment Variables

For testing, you'll need to set up test environment variables:

```bash
SUPABASE_TEST_URL=http://localhost:54321
SUPABASE_TEST_ANON_KEY=your-test-anon-key
```