# End-to-End Tests

This directory contains E2E tests for the Perfect Task web application using Playwright.

## Setup

1. **Install Playwright browsers** (one-time setup):
   ```bash
   npx playwright install chromium
   ```

2. **Ensure environment variables are set**:
   - Copy `.env.local.example` to `.env.local`
   - Set up your Supabase credentials

## Running Tests

### Run all E2E tests (headless)
```bash
pnpm test:e2e
```

### Run tests with UI mode (recommended for development)
```bash
pnpm test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
pnpm test:e2e:headed
```

### Run specific test file
```bash
npx playwright test e2e/basic-smoke.spec.ts
```

### Run tests in debug mode
```bash
npx playwright test --debug
```

## Test Structure

- `basic-smoke.spec.ts` - Basic smoke tests to verify pages load
- `projects.spec.ts` - Project management E2E tests

## Writing New Tests

1. Create a new file in the `e2e` directory with the `.spec.ts` extension
2. Import test utilities: `import { test, expect } from '@playwright/test';`
3. Write your tests using Playwright's API

### Example Test

```typescript
import { test, expect } from '@playwright/test';

test('my test', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

## Test Data Management

### Before Each Test
- Tests should be independent and not rely on previous test state
- Use `test.beforeEach()` to set up test data
- Clean up after tests if needed

### Authentication
Helper functions for authentication are provided in `projects.spec.ts`:
- `signIn(page, email, password)` - Sign in an existing user
- `signUp(page, email, password)` - Create a new user

**Note**: These helpers need to be adapted to your actual authentication flow.

## Debugging Failed Tests

1. **View trace files**:
   ```bash
   npx playwright show-trace trace.zip
   ```

2. **Screenshots**: Screenshots of failures are saved automatically in `test-results/`

3. **Video recordings**: Enable in `playwright.config.ts` if needed

## CI/CD Integration

Tests are configured to:
- Retry failed tests 2 times on CI
- Run in parallel with 1 worker on CI
- Generate HTML report

Add to your CI pipeline:
```yaml
- name: Run E2E tests
  run: pnpm test:e2e
```

## Best Practices

1. **Use data-testid attributes** for stable selectors
2. **Wait for elements** instead of using fixed timeouts
3. **Keep tests independent** - don't rely on test execution order
4. **Use helper functions** for common operations
5. **Test critical user journeys** end-to-end

## Troubleshooting

### Dev server not starting
- Check if port 3000 is available
- Ensure `pnpm dev` works manually
- Check `playwright.config.ts` webServer settings

### Tests timing out
- Increase timeout in test or config
- Check if the app is running properly
- Verify selectors are correct

### Authentication issues
- Verify environment variables are set
- Check if test user exists
- Ensure Supabase is running (for local tests)

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Tests](https://playwright.dev/docs/debug)
