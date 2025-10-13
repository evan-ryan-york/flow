# Multi-Environment Setup Memory

> **Critical Reference Document**: Read this BEFORE making changes to authentication, dashboard, or deployment configurations.

## Overview

This app runs in **three different environments** with a **unified codebase**:
1. **Localhost Web Dev** (`http://localhost:3000`)
2. **Production Web** (Vercel deployment)
3. **Tauri Desktop App** (macOS/Windows native)

All three environments must work with the **same OAuth configuration** and **same codebase**. This document explains the critical decisions and configurations that make this possible.

---

## Critical Configuration: Google OAuth Redirect URIs

### Problem
Google OAuth requires **pre-registered redirect URIs** for security. When a user signs in, Google redirects back to one of these URIs. If the URI isn't on the approved list, Google falls back to the first registered URI (usually production), breaking localhost and Tauri flows.

### Solution: Three Redirect URIs Required

**Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID:**

```
http://localhost:3000/auth/callback
http://localhost:3000
https://[your-production-domain]/auth/callback
```

**Why these three?**
- `http://localhost:3000/auth/callback` - **Localhost web dev**: Standard browser OAuth callback
- `http://localhost:3000` - **Tauri desktop app**: The OAuth plugin creates a temporary HTTP server on port 3000 (root path, not `/auth/callback`)
- `https://[production]/auth/callback` - **Vercel production**: Standard browser OAuth callback

**Supabase Dashboard → Authentication → URL Configuration → Redirect URLs:**

```
http://localhost:3000/**
https://[your-production-domain]/**
```

The `**` wildcard allows any path under that origin.

---

## Critical Code: Dashboard Component Architecture

### The October 12 Incident

**What Happened:**
On October 12, 2025 (commit `558bc6d`), during OAuth debugging work, the dashboard was converted from a **Server Component** to a **Client Component** to support client-side authentication hooks. During this conversion, the fully-featured `ThreeColumnLayout` component was replaced with a minimal `DashboardClient` component.

**What Was Lost:**
1. **Default project selection logic** - Hooks that load saved project preferences and default to "General" project
2. **Calendar panel resizing** - `react-resizable-panels` functionality
3. **Project visibility persistence** - Database sync for selected projects
4. **View integration** - View management features

**The Correct Setup:**

`apps/web/app/dashboard/page.tsx` should use **ThreeColumnLayout**, NOT DashboardClient:

```typescript
'use client';

import { ThreeColumnLayout } from '@/components/ThreeColumnLayout';

export default function Dashboard() {
  // ... auth checking logic ...

  return <ThreeColumnLayout userId={user.id} />;
}
```

**DO NOT:**
- ❌ Replace `ThreeColumnLayout` with a simpler component
- ❌ Remove the initialization hooks from `ThreeColumnLayout`
- ❌ Strip out `useVisibleProjectIds`, `useGeneralProject`, or project persistence logic
- ❌ Remove `react-resizable-panels` or the `PanelGroup` components

**Why ThreeColumnLayout Exists:**
- Contains all initialization logic for default project selection
- Handles project visibility persistence (saves to database)
- Implements resizable panels for better UX
- Integrates view management with project selection
- Provides "unsaved changes" banner when projects differ from active view

---

## Authentication Architecture

### Why Client Component is Required

The dashboard **must be a client component** (`'use client'`) because:
1. OAuth session handling requires client-side hooks (`useSupabase`, `useState`, `useEffect`)
2. TanStack Query hooks require client context
3. Real-time features need client-side subscriptions

### Server vs Client Authentication Flow

**Before (Broken for OAuth):**
```typescript
// Server Component - DOESN'T WORK with OAuth
export default async function Dashboard() {
  const supabase = createServerClient(..., { cookies: ... });
  const { data: { user } } = await supabase.auth.getUser();
  // ...
}
```

**After (Working with OAuth):**
```typescript
// Client Component - WORKS with OAuth
'use client';

export default function Dashboard() {
  const supabase = useSupabase(); // Client-side hook
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      // ...
    };
    checkUser();
  }, []);

  return <ThreeColumnLayout userId={user.id} />;
}
```

### OAuth Callback Flow

**File:** `apps/web/app/auth/callback/page.tsx`

This page handles the OAuth redirect from Google. It must be a **client component** that:
1. Extracts the `code` parameter from the URL
2. Waits for `createBrowserClient` from `@supabase/ssr` to automatically exchange the code for a session (PKCE flow)
3. Checks for session and redirects to `/dashboard` or `/login`

**DO NOT:**
- ❌ Manually call `exchangeCodeForSession()` - Supabase SSR handles this automatically
- ❌ Use server-side `createServerClient` - OAuth requires client-side handling
- ❌ Skip the 1-second delay after detecting `code` parameter - Gives Supabase time to process PKCE exchange

---

## Tauri-Specific Configuration

### Why Tauri Uses Port 3000

**File:** `apps/web/lib/tauri-oauth.ts` (line 214)

```typescript
const FIXED_PORT = 3000;
const port = await tauriOAuth.start({ ports: [FIXED_PORT] });
```

**Why fixed port?**
- Google OAuth requires **exact redirect URIs** to be registered
- Random ports would require wildcards, which Google doesn't support
- Port 3000 is used because it's the same as Next.js dev server (already familiar)

**How Tauri OAuth Works:**
1. User clicks "Sign in with Google" in desktop app
2. `tauri-oauth` plugin creates a temporary HTTP server on `http://localhost:3000`
3. System browser opens Google OAuth page
4. User signs in with Google
5. Google redirects to `http://localhost:3000` (captured by plugin's HTTP server)
6. Plugin extracts auth code from URL and emits event to app
7. App exchanges code for session using PKCE
8. Plugin shuts down HTTP server

**DO NOT:**
- ❌ Change port 3000 to a random port
- ❌ Remove the PKCE code_verifier storage logic
- ❌ Use a different redirect URL for Tauri

---

## Supabase Client Architecture

### Single Source of Truth

**File:** `packages/data/supabase.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr';

let supabaseInstance: SupabaseClient | null = null;

export function initializeSupabase(url: string, anonKey: string) {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient(url, anonKey);
  }
  return supabaseInstance;
}

export function getSupabaseClient() {
  if (!supabaseInstance) {
    throw new Error('Supabase client not initialized');
  }
  return supabaseInstance;
}
```

**Why `createBrowserClient` from `@supabase/ssr`?**
- Handles PKCE OAuth flow automatically
- Manages session persistence in localStorage
- Detects OAuth callbacks and exchanges code for session
- Works across all environments (web, localhost, Tauri)

**DO NOT:**
- ❌ Create multiple Supabase client instances
- ❌ Use `createClient` from `@supabase/supabase-js` directly
- ❌ Use `createServerClient` in client components
- ❌ Manually handle OAuth code exchange when using `createBrowserClient`

### Service Layer Pattern

**Every service function MUST:**
```typescript
import { getSupabaseClient } from '../supabase';

const supabase = getSupabaseClient();

export const serviceFunction = async (...) => {
  const { data, error } = await supabase.from('table').select();
  if (error) throw new Error(`Context: ${error.message}`);
  const validated = Schema.parse(data);
  return validated;
};
```

---

## Deployment Configuration

### Vercel Environment Variables

**Required in Vercel Project Settings:**
```
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
```

**Critical:** These must be set in Vercel dashboard, not just `.env.local`.

### Next.js Configuration

**File:** `apps/web/next.config.js`

```javascript
const nextConfig = {
  transpilePackages: [
    '@perfect-task-app/data',
    '@perfect-task-app/models',
    '@perfect-task-app/ui'
  ],
  output: process.env.NEXT_OUTPUT === 'export' ? 'export' : undefined,
};
```

**For Tauri builds only:**
```bash
NEXT_OUTPUT=export pnpm build
```

**DO NOT:**
- ❌ Use `output: 'export'` for Vercel deployments (breaks server features)
- ❌ Remove `transpilePackages` (breaks monorepo imports)

---

## Testing Checklist

Before deploying or making auth changes, test **all three environments**:

### ✅ Localhost Web Dev
```bash
pnpm dev:web
# Visit http://localhost:3000/login
# Click "Sign in with Google"
# Should redirect back to http://localhost:3000/auth/callback
# Should land on dashboard with default projects selected
# Should be able to resize calendar panel left/right
```

### ✅ Tauri Desktop
```bash
pnpm dev:desktop
# Click "Sign in with Google" in desktop app
# System browser should open
# After auth, desktop app should auto-login
# Should land on dashboard with default projects selected
# Should be able to resize calendar panel left/right
```

### ✅ Production (Vercel)
```bash
# Deploy to Vercel
# Visit https://[your-domain]/login
# Click "Sign in with Google"
# Should redirect back to https://[your-domain]/auth/callback
# Should land on dashboard with default projects selected
# Should be able to resize calendar panel left/right
```

---

## Common Pitfalls (What NOT to Do)

### ❌ Don't Change Dashboard Architecture
**Bad:**
```typescript
// Creating a minimal DashboardClient without hooks
export function DashboardClient({ user }) {
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  return <div>...</div>;
}
```

**Good:**
```typescript
// Using ThreeColumnLayout with all features
export default function Dashboard() {
  // ... auth check ...
  return <ThreeColumnLayout userId={user.id} />;
}
```

### ❌ Don't Use Random Ports for Tauri OAuth
**Bad:**
```typescript
const port = await tauriOAuth.start(); // Random port - breaks Google OAuth
```

**Good:**
```typescript
const FIXED_PORT = 3000;
const port = await tauriOAuth.start({ ports: [FIXED_PORT] });
```

### ❌ Don't Remove Localhost from OAuth URIs
**Bad:** "I'll remove localhost URIs to be more secure in production"

**Result:** Local development and Tauri desktop app completely break.

### ❌ Don't Manually Handle PKCE with `createBrowserClient`
**Bad:**
```typescript
const { data } = await supabase.auth.exchangeCodeForSession(code);
```

**Good:**
```typescript
// Let createBrowserClient handle it automatically
const code = searchParams.get('code');
if (code) {
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for auto-exchange
}
```

---

## Key Files Reference

| File | Purpose | Critical? |
|------|---------|-----------|
| `apps/web/app/dashboard/page.tsx` | Dashboard entry point - must use ThreeColumnLayout | ✅ YES |
| `apps/web/components/ThreeColumnLayout.tsx` | Full-featured layout with project selection + resizing | ✅ YES |
| `apps/web/app/auth/callback/page.tsx` | OAuth callback handler | ✅ YES |
| `apps/web/lib/tauri-oauth.ts` | Tauri OAuth flow implementation | ✅ YES (Tauri only) |
| `packages/data/supabase.ts` | Shared Supabase client (single source of truth) | ✅ YES |
| `apps/web/next.config.js` | Next.js configuration for monorepo + export | ✅ YES |

---

## When Things Break

### Symptom: Localhost redirects to production after Google sign-in
**Cause:** `http://localhost:3000/auth/callback` missing from Google Cloud Console redirect URIs
**Fix:** Add all three redirect URIs to Google Cloud Console

### Symptom: Default projects aren't selected on dashboard
**Cause:** `DashboardClient` used instead of `ThreeColumnLayout`
**Fix:** Change dashboard page.tsx to use `ThreeColumnLayout`

### Symptom: Can't resize calendar panel
**Cause:** `react-resizable-panels` removed or `ThreeColumnLayout` replaced
**Fix:** Restore `ThreeColumnLayout` with `PanelGroup` components

### Symptom: Tauri OAuth fails with "No authorization code received"
**Cause:** Port changed from 3000 or Google OAuth URI incorrect
**Fix:** Ensure `FIXED_PORT = 3000` and `http://localhost:3000` is in Google redirect URIs

### Symptom: Server Component error when using auth hooks
**Cause:** Dashboard page missing `'use client'` directive
**Fix:** Add `'use client'` at top of dashboard page.tsx

---

## History

- **2025-09-27**: Project visibility persistence system implemented (commit `a9bebed`)
- **2025-10-07**: Resizable panels added to ThreeColumnLayout (commit `4356723`)
- **2025-10-08**: Tauri OAuth implementation with fixed port 3000 (commit `fcb1a80`)
- **2025-10-12**: Dashboard converted to client component, accidentally lost features (commit `558bc6d`)
- **2025-10-13**: Features restored by switching back to ThreeColumnLayout (this document created)

---

## Final Notes

**If you're about to change authentication or dashboard code, ask yourself:**

1. Will this work in **all three environments** (localhost, production, Tauri)?
2. Am I keeping `ThreeColumnLayout` with all its hooks intact?
3. Am I maintaining the three Google OAuth redirect URIs?
4. Am I using the shared Supabase client from `packages/data/supabase.ts`?
5. Is the dashboard still a client component with `'use client'`?

**If you answer "no" to any of these, STOP and re-read this document.**

---

**Last Updated:** 2025-10-13
**Author:** Claude Code Agent
**Status:** Production Critical - Do Not Ignore
