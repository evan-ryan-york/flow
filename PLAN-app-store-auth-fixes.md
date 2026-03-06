# App Store Rejection Fix Plan

**Date**: 2026-03-04
**Rejection Guidelines**: 4.8 (Sign in with Apple), 4.0 (In-app auth), 5.1.1 (Account deletion)

---

## Overview

Three issues to resolve before resubmission:

1. **Sign in with Apple** — Required because we offer Google sign-in
2. **In-app authentication** — Auth currently redirects to Safari via `window.location.href`; must stay in-app
3. **Account deletion** — Required because we support account creation

**IMPORTANT**: Phases 1A, 1B, 2A (Xcode), and 2A (GoogleService-Info.plist) are manual steps the human must do in Xcode/dashboards. The agent should implement all code changes and flag the manual steps clearly.

---

## Architecture Context

### Project Structure (auth-relevant files only)

```
packages/data/
  index.ts                          # Re-exports: export * from './services/authService' (and all other services/hooks)
  supabase.ts                       # Singleton Supabase client (platform-aware: Capacitor/Tauri/Web)
  capacitor-storage.ts              # Custom SupportedStorage for Capacitor using @capacitor/preferences
  services/authService.ts           # Auth service functions (signUp, signIn, signOut, getSession, getCurrentUser, signInWithGoogleIdToken)
  hooks/useAuth.ts                  # TanStack Query hooks (useSession, useCurrentUser, useSignUp, useSignIn, useSignOut, useSignInWithGoogleIdToken)
  hooks/index.ts                    # Re-exports: export * from './useAuth' (and all other hooks)

apps/web/
  lib/env.ts                        # Exports env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  lib/auth.tsx                      # AuthProvider context (NOT used for login flow — LoginForm.tsx handles it directly)
  lib/providers.tsx                  # useSupabase() hook, TanStack QueryProvider
  lib/capacitor-oauth.ts            # Capacitor Google OAuth — currently opens Safari (THIS IS THE PROBLEM)
  lib/tauri-oauth.ts                # Tauri Google OAuth — uses localhost server + system browser (desktop, not App Store)
  app/login/components/LoginForm.tsx # Master login form (730 lines) — handles all platforms
  app/auth/callback/page.tsx         # OAuth callback handler (web only)
  components/ProfileMenu.tsx         # Desktop profile dropdown with logout
  components/mobile/MobileAccountView.tsx  # Mobile account view with logout

apps/mobile/
  capacitor.config.ts               # Capacitor config (appId: com.perfecttask.app)
  ios/App/App.xcodeproj/            # Xcode project

packages/ui/
  index.ts                          # Exports all shadcn components including AlertDialog, Dialog, Button, Input
```

### Available shadcn/ui Components

Already installed and exported from `@flow-app/ui`:
- `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogTrigger`
- `Dialog`, `Button`, `Input`, `Label`, `Avatar`, `Popover`, `Card`, `Badge`, `Checkbox`, `Select`, `Textarea`, `Calendar`
- `cn()` utility for class merging

### Supabase Client Pattern

All code uses `getSupabaseClient()` from `packages/data/supabase.ts`. On Capacitor, the client has:
- `persistSession: false` (session managed manually via `@capacitor/preferences`)
- `autoRefreshToken: false` (tokens managed manually)
- Custom fetch wrapper that injects `Authorization: Bearer <token>` from Preferences storage
- Key: `flow-app-access-token` stores the access token separately for the custom fetch wrapper
- Key: `sb-sprjddkfkwrrebazjxvf-auth-token` stores the full session object
- Key: `flow-app-user-data` stores user metadata

`reinitializeSupabaseClient()` is exported and used after manually storing a new session to force the client to pick up new tokens.

### Current Capacitor Google OAuth Flow (THE PROBLEM)

`apps/web/lib/capacitor-oauth.ts` currently does:
```typescript
window.location.href = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${redirectUrl}`;
```
This opens Safari, which Apple rejected. The return flow uses deep links + `App.addListener('appStateChange')` in LoginForm.tsx to capture the callback URL, manually decode the JWT, build a session object, and store it in Preferences.

### New User Trigger

When a new auth user is created, `handle_new_user()` trigger runs (SECURITY DEFINER):
- Creates a `profiles` row with `id` and `avatar_url` from `raw_user_meta_data`
- Creates a "General" project owned by the user
- Updates `visible_project_ids` on the profile
- This trigger fires for ALL auth providers (Google, Apple, email) — no changes needed for Apple support

### Database Tables (for account deletion)

All tables with user data (in FK dependency order, leaves first):
1. `calendar_events` (user_id → auth.users)
2. `calendar_sync_state` (user_id → auth.users)
3. `calendar_subscriptions` (connection_id → calendar_connections)
4. `calendar_connections` (was `google_calendar_connections`, renamed; user_id → auth.users)
5. `oauth_state_tokens` (user_id)
6. `time_block_tasks` (time_block_id → time_blocks, task_id → tasks)
7. `time_blocks` (user_id → profiles)
8. `custom_property_values` (task_id → tasks, definition_id → custom_property_definitions)
9. `custom_property_project_assignments` (project_id → projects, definition_id → custom_property_definitions)
10. `custom_property_definitions` (project_id → projects, created_by → profiles)
11. `tasks` (project_id → projects, created_by → profiles)
12. `views` (user_id → profiles)
13. `project_users` (project_id → projects, user_id → profiles)
14. `projects` (owner_id → profiles)
15. `profiles` (id → auth.users, has ON DELETE CASCADE)

**Note**: `google_calendar_connections` was renamed to `calendar_connections` in migration `20251228092617`. The delete function must use `calendar_connections`.

---

## Phase 1: Sign in with Apple (Guideline 4.8)

### 1A. Supabase Dashboard Configuration (MANUAL — human must do this)

- Supabase Dashboard → Authentication → Providers → Apple → Enable
- Configure:
  - **Service ID** (e.g., `com.perfecttask.app.signin`)
  - **Team ID** from Apple Developer account
  - **Key ID** + **Private Key** from Apple Developer → Keys → Sign in with Apple
- Add authorized redirect URI: `https://sprjddkfkwrrebazjxvf.supabase.co/auth/v1/callback`

### 1B. Xcode Configuration (MANUAL — human must do this)

- Open `apps/mobile/ios/App/App.xcodeproj` in Xcode
- App target → Signing & Capabilities → "+ Capability" → "Sign in with Apple"
- Apple Developer portal → Identifiers → App ID `com.perfecttask.app` → enable "Sign in with Apple"

### 1C. Install Capacitor Apple Sign-In Plugin

```bash
# Run from project root
cd apps/mobile && pnpm add @capacitor-community/apple-sign-in && npx cap sync ios
```

### 1D. Add `signInWithAppleIdToken()` to authService

**File**: `packages/data/services/authService.ts`

Append after the existing `signInWithGoogleIdToken` function (after line 171):

```typescript
export const signInWithAppleIdToken = async (idToken: string, nonce?: string): Promise<User> => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: idToken,
      nonce,
    });

    if (error) {
      throw new Error(`Apple sign in failed: ${error.message}`);
    }

    if (!data.user) {
      throw new Error('Apple sign in failed: No user data returned');
    }

    return data.user;
  } catch (error) {
    console.error('AuthService.signInWithAppleIdToken error:', error);
    throw error;
  }
};
```

### 1E. Add `useSignInWithAppleIdToken` hook

**File**: `packages/data/hooks/useAuth.ts`

Add import of `signInWithAppleIdToken` to the import statement on line 2, then append after `useSignInWithGoogleIdToken`:

```typescript
export const useSignInWithAppleIdToken = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ idToken, nonce }: { idToken: string; nonce?: string }) =>
      signInWithAppleIdToken(idToken, nonce),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
};
```

### 1F. Add Apple Sign-In to LoginForm

**File**: `apps/web/app/login/components/LoginForm.tsx`

Add a `handleAppleSignIn` function and an Apple sign-in button. The Capacitor flow:

```typescript
const handleAppleSignIn = async () => {
  try {
    setIsLoading(true);
    setError(null);

    if (isCapacitorEnv) {
      // Native Apple Sign-In (stays in-app via AuthenticationServices framework)
      const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
      const result = await SignInWithApple.authorize({
        clientId: 'com.perfecttask.app',
        redirectURI: 'https://sprjddkfkwrrebazjxvf.supabase.co/auth/v1/callback',
        scopes: 'email name',
      });

      const idToken = result.response.identityToken;
      if (!idToken) {
        throw new Error('No identity token received from Apple');
      }

      // Exchange Apple ID token for Supabase session
      const { signInWithAppleIdToken } = await import('@flow-app/data');
      const user = await signInWithAppleIdToken(idToken);

      // Store session in Capacitor Preferences (same pattern as Google native flow)
      // After signInWithIdToken succeeds, getSession() should have the session
      // but on Capacitor it hangs, so we store manually
      await storeCapacitorSession(supabase);

      router.replace('/dashboard');
      return;
    }

    // Web/Desktop: standard OAuth redirect
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) throw error;
  } catch (error: unknown) {
    console.error('Apple sign-in error:', error);
    setError(error instanceof Error ? error.message : 'Failed to sign in with Apple');
    setIsLoading(false);
  }
};
```

Add the Apple button in the JSX after the Google button (around line 724). Use Apple's required black button style:

```tsx
<button
  onClick={handleAppleSignIn}
  disabled={isLoading}
  className="w-full inline-flex justify-center items-center py-2 px-4 rounded-md shadow-sm bg-black text-sm font-medium text-white hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
>
  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>
  Sign in with Apple
</button>
```

---

## Phase 2: In-App Auth / Native Google Sign-In (Guideline 4.0)

### 2A. Install Capacitor Google Auth Plugin

```bash
# Run from project root
cd apps/mobile && pnpm add @codetrix-studio/capacitor-google-auth && npx cap sync ios
```

**Xcode setup (MANUAL — human must do this)**:
- Download `GoogleService-Info.plist` from Google Cloud Console → your iOS client
- Add it to the Xcode project under `App/App/`
- Add the reversed client ID as a URL scheme: Xcode → App target → Info → URL Types → add `com.googleusercontent.apps.YOUR_CLIENT_ID` (reversed)

### 2B. Add GoogleAuth Plugin Config to Capacitor

**File**: `apps/mobile/capacitor.config.ts`

Add `GoogleAuth` to the `plugins` object:

```typescript
plugins: {
  GoogleAuth: {
    scopes: ['profile', 'email'],
    serverClientId: 'YOUR_GOOGLE_OAUTH_CLIENT_ID', // Same as NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID
    forceCodeForRefreshToken: true,
  },
  SplashScreen: {
    // ... existing
  },
  // ... rest of existing plugins
}
```

**Note**: `serverClientId` must be the **web** client ID (not the iOS client ID). This is the same value as `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`. Since env vars aren't available at Capacitor config time, this must be hardcoded or the human must provide the value.

### 2C. Rewrite `capacitor-oauth.ts` to Use Native Google SDK

**File**: `apps/web/lib/capacitor-oauth.ts`

Replace the entire file. The new version uses the native Google Sign-In SDK instead of Safari redirect:

```typescript
// apps/web/lib/capacitor-oauth.ts
import type { SupabaseClient } from '@supabase/supabase-js';

// Detect if we're running in Capacitor
export function isCapacitor(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'capacitor:';
}

/**
 * Handles Google OAuth for Capacitor using the native Google Sign-In SDK.
 * Shows an in-app Google sign-in sheet instead of redirecting to Safari.
 * Returns the Google ID token for exchange with Supabase.
 */
export async function handleCapacitorGoogleOAuth(_supabase: SupabaseClient) {
  try {
    const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');

    // Initialize the plugin
    await GoogleAuth.initialize();

    // Native Google sign-in sheet (stays in-app)
    const googleUser = await GoogleAuth.signIn();

    // Extract the ID token
    const idToken = googleUser.authentication.idToken;

    if (!idToken) {
      throw new Error('No ID token received from Google');
    }

    return { success: true, idToken };
  } catch (error) {
    console.error('Capacitor Google OAuth error:', error);
    return { success: false, error: (error as Error).message, idToken: undefined };
  }
}
```

### 2D. Refactor LoginForm.tsx — Replace Deep Link Flow with Native SDK Flow

**File**: `apps/web/app/login/components/LoginForm.tsx`

This is the most significant change. The native Google SDK returns an ID token directly (no deep links, no URL parsing, no manual JWT decoding).

**What to REMOVE from LoginForm.tsx**:

1. **Remove** the `authUrlToProcess` state (line 18)
2. **Remove** the deep link listener `useEffect` (lines 166-238) — the one that sets up `App.addListener('appStateChange')` and calls `App.getLaunchUrl()`
3. **Remove** the URL-processing `useEffect` (lines 243-411) — the one that watches `authUrlToProcess`, parses the callback URL, decodes the JWT, manually builds the session object, and stores it in Preferences
4. **Remove** the `import { App } from '@capacitor/app'` and `import type { PluginListenerHandle } from '@capacitor/core'` (lines 9-10) — no longer needed for auth

**What to ADD**:

A helper function to store the session in Capacitor Preferences after `signInWithIdToken` succeeds. Since `supabase.auth.getSession()` hangs on Capacitor, we need to get the session data from the `signInWithIdToken` response directly.

**Rewritten `handleGoogleSignIn` Capacitor block** (replaces lines 482-495):

```typescript
if (isCapacitorEnv) {
  console.log('Using native Google Sign-In SDK...');
  const result = await handleCapacitorGoogleOAuth(supabase);

  if (!result.success || !result.idToken) {
    throw new Error(result.error || 'Failed to authenticate with Google');
  }

  // Exchange the Google ID token for a Supabase session
  const supabaseClient = supabase;
  const { data, error: signInError } = await supabaseClient.auth.signInWithIdToken({
    provider: 'google',
    token: result.idToken,
  });

  if (signInError) throw signInError;
  if (!data.session || !data.user) throw new Error('No session returned from Supabase');

  // Store session in Capacitor Preferences
  const { Preferences } = await import('@capacitor/preferences');
  const storageKey = 'sb-sprjddkfkwrrebazjxvf-auth-token';

  const sessionData = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
    expires_at: data.session.expires_at,
    token_type: data.session.token_type,
    user: data.user,
  };

  await Preferences.set({ key: storageKey, value: JSON.stringify(sessionData) });
  await Preferences.set({ key: 'flow-app-access-token', value: data.session.access_token });
  await Preferences.set({
    key: 'flow-app-user-data',
    value: JSON.stringify({
      id: data.user.id,
      email: data.user.email,
      user_metadata: data.user.user_metadata,
    }),
  });

  // Reinitialize Supabase client to pick up new tokens
  const { reinitializeSupabaseClient } = await import('@flow-app/data');
  reinitializeSupabaseClient();

  router.replace('/dashboard');
  return;
}
```

**The same Capacitor Preferences storage pattern should be used for Apple sign-in** (Phase 1F). Extract a shared helper:

```typescript
async function storeCapacitorSession(session: { access_token: string; refresh_token: string; expires_in: number; expires_at: number; token_type: string }, user: User) {
  const { Preferences } = await import('@capacitor/preferences');
  const storageKey = 'sb-sprjddkfkwrrebazjxvf-auth-token';

  const sessionData = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type,
    user,
  };

  await Preferences.set({ key: storageKey, value: JSON.stringify(sessionData) });
  await Preferences.set({ key: 'flow-app-access-token', value: session.access_token });
  await Preferences.set({
    key: 'flow-app-user-data',
    value: JSON.stringify({
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
    }),
  });

  const { reinitializeSupabaseClient } = await import('@flow-app/data');
  reinitializeSupabaseClient();
}
```

**Keep the following useEffects in LoginForm.tsx** (they are still needed):
- Session check on mount (lines 107-164) — checks if user is already logged in
- URL hash token check (lines 55-104) — handles web OAuth callback
- Callback error check (lines 39-50) — shows auth errors from URL params

**Keep the `App` import ONLY if** the magic link flow on Capacitor still uses `App.getLaunchUrl()` for deep link handling. If magic link is web-only (which the current code suggests — it warns against magic links on Tauri, and the deep link listener was primarily for Google OAuth), then the `App` import can be removed entirely. Check if `handleMagicLink` on Capacitor actually relies on deep link listeners — looking at the code, it sets `redirectTo` to `${window.location.origin}/auth/callback` which won't work on Capacitor anyway. The magic link flow should be fine without the deep link listeners.

### 2E. Magic Link (No Changes Needed)

The magic link flow sends an email. The user opens their email app (not Safari from within the app). Apple's rejection was specifically about the Google OAuth Safari redirect, not magic link. No changes needed unless Apple flags it in a subsequent review.

---

## Phase 3: Account Deletion (Guideline 5.1.1)

### 3A. Database Migration

**File**: `supabase/migrations/20260304000000_add_delete_user_account.sql`

```sql
-- Migration: Add account deletion function
-- Deletes all user data across all tables, respecting foreign key constraints
-- Called via Edge Function with service role key

CREATE OR REPLACE FUNCTION delete_user_data(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Calendar-related (calendar_connections was renamed from google_calendar_connections)
  DELETE FROM calendar_events WHERE user_id = target_user_id;
  DELETE FROM calendar_sync_state WHERE user_id = target_user_id;
  DELETE FROM calendar_subscriptions WHERE connection_id IN (
    SELECT id FROM calendar_connections WHERE user_id = target_user_id
  );
  DELETE FROM calendar_connections WHERE user_id = target_user_id;
  DELETE FROM oauth_state_tokens WHERE user_id = target_user_id;

  -- Time blocks (must delete join table first)
  DELETE FROM time_block_tasks WHERE time_block_id IN (
    SELECT id FROM time_blocks WHERE user_id = target_user_id
  );
  DELETE FROM time_blocks WHERE user_id = target_user_id;

  -- Custom property values (on tasks the user created)
  DELETE FROM custom_property_values WHERE task_id IN (
    SELECT id FROM tasks WHERE created_by = target_user_id
  );

  -- Tasks
  DELETE FROM tasks WHERE created_by = target_user_id;

  -- Custom property project assignments (for projects the user owns)
  DELETE FROM custom_property_project_assignments WHERE project_id IN (
    SELECT id FROM projects WHERE owner_id = target_user_id
  );

  -- Custom property definitions
  DELETE FROM custom_property_definitions WHERE created_by = target_user_id;

  -- Views
  DELETE FROM views WHERE user_id = target_user_id;

  -- Project memberships (both as member and for owned projects)
  DELETE FROM project_users WHERE user_id = target_user_id;
  DELETE FROM project_users WHERE project_id IN (
    SELECT id FROM projects WHERE owner_id = target_user_id
  );

  -- Projects
  DELETE FROM projects WHERE owner_id = target_user_id;

  -- Profile (has ON DELETE CASCADE from auth.users, but delete explicitly for clarity)
  DELETE FROM profiles WHERE id = target_user_id;
END;
$$;
```

**Apply via psql** (human must run):
```bash
psql "postgresql://postgres:$DATABASE_PASSWORD@db.sprjddkfkwrrebazjxvf.supabase.co:5432/postgres" \
  -f supabase/migrations/20260304000000_add_delete_user_account.sql
```

### 3B. Supabase Edge Function

**File**: `supabase/functions/delete-account/index.ts`

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Create admin client with service role key
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Verify the user from their JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  )

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Delete all user data via the database function
  const { error: dataError } = await supabase.rpc('delete_user_data', {
    target_user_id: user.id,
  })

  if (dataError) {
    console.error('Failed to delete user data:', dataError)
    return new Response(JSON.stringify({ error: 'Failed to delete account data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Delete the auth user
  const { error: authError } = await supabase.auth.admin.deleteUser(user.id)

  if (authError) {
    console.error('Failed to delete auth user:', authError)
    return new Response(JSON.stringify({ error: 'Failed to delete auth user' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
```

**Deploy** (human must run):
```bash
npx supabase functions deploy delete-account --project-ref sprjddkfkwrrebazjxvf
```

### 3C. Add `deleteAccount()` Service Function

**File**: `packages/data/services/authService.ts`

Append after `signInWithAppleIdToken`:

```typescript
export const deleteAccount = async (): Promise<void> => {
  try {
    const supabase = getSupabaseClient();

    // Get current session for the auth header
    // On Capacitor, getSession() hangs, so read from Preferences
    let accessToken: string | null = null;
    const isCapacitorEnv = typeof window !== 'undefined' && window.location.protocol === 'capacitor:';

    if (isCapacitorEnv) {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: 'flow-app-access-token' });
      accessToken = value;
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      accessToken = session?.access_token ?? null;
    }

    if (!accessToken) {
      throw new Error('No active session');
    }

    const supabaseUrl = typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : '';

    const response = await fetch(
      `${supabaseUrl}/functions/v1/delete-account`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete account');
    }

    // Clear local session
    if (isCapacitorEnv) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key: 'sb-sprjddkfkwrrebazjxvf-auth-token' });
      await Preferences.remove({ key: 'flow-app-access-token' });
      await Preferences.remove({ key: 'flow-app-user-data' });
    }

    await supabase.auth.signOut();
  } catch (error) {
    console.error('AuthService.deleteAccount error:', error);
    throw error;
  }
};
```

### 3D. Add `useDeleteAccount` Hook

**File**: `packages/data/hooks/useAuth.ts`

Add `deleteAccount` to the import on line 2, then append:

```typescript
export const useDeleteAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.clear();
    },
  });
};
```

### 3E. Add Delete Account UI to ProfileMenu

**File**: `apps/web/components/ProfileMenu.tsx`

Current file is 79 lines. Add:
- Import `useDeleteAccount` from `@flow-app/data`
- Import `AlertDialog` components from `@flow-app/ui`
- Import `Trash` from `iconoir-react` (already used for icons in this project)
- A `showDeleteConfirm` state
- A "Delete Account" button in the popover menu below the Logout button
- An `AlertDialog` for confirmation that requires typing "DELETE" to confirm

The delete account button goes inside the `<div className="p-2">` block after the logout button. The AlertDialog goes outside the Popover (at the component root level).

### 3F. Add Delete Account UI to MobileAccountView

**File**: `apps/web/components/mobile/MobileAccountView.tsx`

Same pattern as ProfileMenu:
- Import `useDeleteAccount` from `@flow-app/data`
- Import `AlertDialog` components from `@flow-app/ui`
- Add a "Delete Account" button below the Logout button
- Add confirmation AlertDialog with "DELETE" input requirement

---

## Implementation Order

| Step | Task | Type | Files |
|------|------|------|-------|
| 1 | Install Capacitor plugins | Shell | `apps/mobile/package.json` |
| 2 | Add GoogleAuth config to capacitor.config.ts | Code | `apps/mobile/capacitor.config.ts` |
| 3 | Add `signInWithAppleIdToken` to authService | Code | `packages/data/services/authService.ts` |
| 4 | Add `deleteAccount` to authService | Code | `packages/data/services/authService.ts` |
| 5 | Add hooks (`useSignInWithAppleIdToken`, `useDeleteAccount`) | Code | `packages/data/hooks/useAuth.ts` |
| 6 | Rewrite `capacitor-oauth.ts` (native Google SDK) | Code | `apps/web/lib/capacitor-oauth.ts` |
| 7 | Refactor `LoginForm.tsx` (remove deep link flow, add Apple button, use native Google SDK) | Code | `apps/web/app/login/components/LoginForm.tsx` |
| 8 | Add delete account to ProfileMenu | Code | `apps/web/components/ProfileMenu.tsx` |
| 9 | Add delete account to MobileAccountView | Code | `apps/web/components/mobile/MobileAccountView.tsx` |
| 10 | Create database migration | Code | `supabase/migrations/20260304000000_add_delete_user_account.sql` |
| 11 | Create edge function | Code | `supabase/functions/delete-account/index.ts` |

### Manual Steps (human must do, not code)

- [ ] Enable Apple provider in Supabase Dashboard
- [ ] Add "Sign in with Apple" capability in Xcode
- [ ] Add GoogleService-Info.plist to Xcode project
- [ ] Add reversed Google client ID URL scheme in Xcode
- [ ] Hardcode `serverClientId` in capacitor.config.ts (or have human provide the value)
- [ ] Apply database migration via psql
- [ ] Deploy edge function via Supabase CLI
- [ ] Test all flows on physical iOS device

---

## Testing Checklist

- [ ] Google sign-in shows native in-app sheet on iOS (not Safari)
- [ ] Google sign-in still works on web (unchanged)
- [ ] Google sign-in still works on Tauri desktop (unchanged)
- [ ] Apple sign-in shows native Apple auth sheet on iOS
- [ ] Apple sign-in works on web (optional)
- [ ] New user via Apple gets profile + General project created (trigger handles it)
- [ ] Magic link flow still works on web
- [ ] Account deletion removes all user data from all tables
- [ ] Account deletion removes auth user from Supabase
- [ ] Account deletion clears local session and redirects to login
- [ ] Account deletion confirmation dialog requires typing "DELETE"
- [ ] Account deletion works on both web and mobile
- [ ] Existing sessions remain valid (no breaking changes)
