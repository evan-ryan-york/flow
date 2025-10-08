# Tauri Desktop Authentication Issues - Lessons Learned

**Date**: 2025-10-08
**Status**: UNRESOLVED
**Time Spent**: ~4 hours
**Outcome**: Failed to implement working authentication for Tauri desktop app

## Summary

Attempted to implement authentication (both magic link and Google OAuth) for the Tauri v1 desktop application. After numerous attempts and approaches, **none worked**. The fundamental issue is that Tauri desktop apps use a custom protocol (`tauri://localhost`) that is incompatible with standard OAuth/magic link flows that expect `http://` or `https://` URLs.

## What We Tried

### 1. Server-Side Auth with Next.js Server Components
**Approach**: Used `cookies()` from `next/headers` and `createServerClient` from `@supabase/ssr`
**Issue**: Next.js static export (`output: 'export'`) cannot use server-side features like cookies
**Result**: Build fails with "couldn't be rendered statically because it used `cookies`"

### 2. Client-Side Auth Migration
**Approach**: Converted all pages to `'use client'` and used `createBrowserClient`
**Files Changed**:
- `/app/page.tsx` - converted to client-side redirect
- `/app/dashboard/page.tsx` - converted to client-side auth check
- `/app/app/layout.tsx` - converted to client-side auth guard
- `/app/app/page.tsx` - converted to client-side
- `/app/auth/callback/route.ts` → `/app/auth/callback/page.tsx` (API route to page)

**Issue**: Static export works, but OAuth callbacks fail because...

### 3. OAuth Redirect URL Problems

**The Core Problem**:
- Tauri apps run on `tauri://localhost` (custom protocol)
- OAuth providers redirect to URLs specified in Supabase
- When magic link/OAuth redirects to `tauri://localhost/auth/callback`, the browser tries to open it as a URL
- Result: "This site can't be reached"

**What we tried**:
- Added `tauri://localhost/auth/callback` to Supabase redirect URLs ❌
- Added `http://localhost:3535/auth/callback` for localhost server ❌
- Tried using `http://localhost:3000` ❌

### 4. Magic Link Flow
**Approach**: Send magic link to email, user clicks link
**Issue**: Email link opens in default browser (Safari/Chrome), not in Tauri app
**Result**: Browser shows "This site can't be reached" because `tauri://` protocol only works in Tauri

### 5. Google OAuth Flow
**Approach**: Click "Sign in with Google" button
**Issue**: Same redirect problem - Google redirects to `tauri://localhost` or `localhost:3535` which doesn't work
**Result**: "This site can't be reached"

### 6. Email/Password Authentication
**Approach**: Traditional username/password login
**Status**: NOT ATTEMPTED (user rejected this approach)
**Note**: This would likely work since it doesn't require redirects

### 7. OTP Code (6-digit) Authentication
**Approach**: Email sends 6-digit code, user enters in app
**Issue**: Supabase sends magic link by default, not just code
**Status**: Partially implemented but not fully tested

### 8. `tauri-plugin-oauth` Approach
**Approach**: Use `tauri-plugin-oauth` to start localhost server
**Plugin**: https://github.com/FabianLars/tauri-plugin-oauth

**What it does**:
- Starts a localhost server on a random port (e.g., 3535)
- OAuth provider redirects to `http://localhost:3535`
- Plugin captures the callback and emits event to app

**Implementation Steps**:
```rust
// Cargo.toml
tauri-plugin-oauth = { git = "https://github.com/FabianLars/tauri-plugin-oauth", branch = "v1" }

// main.rs
tauri::Builder::default()
    .plugin(tauri_plugin_oauth::init())
```

```typescript
import { start, onUrl } from '@fabianlars/tauri-plugin-oauth';

const port = await start();
await onUrl((url) => {
  // Handle callback
});
```

**Issue**:
- Plugin successfully starts localhost server
- BUT magic link still opens in default browser (not Tauri app)
- Browser can't connect to Tauri's localhost server
- OAuth redirect goes to browser, which also can't reach Tauri's localhost

**Result**: FAILED - Same fundamental problem

### 9. Tauri Shell API for Opening Browser
**Approach**: Use `shell.open()` to open OAuth URL in system browser
**Issue**: Even when Google OAuth opens in browser, callback still fails
**Error**: "This site can't be reached" at `http://localhost:3535/?code=...`

## The Fundamental Problem

**OAuth/Magic Links require:**
1. User clicks link in email/browser
2. Link redirects to your app with auth code
3. App exchanges code for session

**Tauri's reality:**
- Tauri apps use `tauri://localhost` protocol
- Email links/OAuth redirects open in default browser
- Browser cannot navigate to `tauri://` URLs
- Localhost servers in Tauri app are isolated from browser

**The Gap**: No reliable way to get auth tokens from browser back into Tauri app

## What Actually Works

### For Web (`pnpm dev:web`)
✅ Server-side auth with cookies
✅ Magic links
✅ Google OAuth
✅ All auth methods work perfectly

### For Mobile (Capacitor)
✅ Deep links can be configured
✅ Custom URL schemes work
✅ OAuth should work (not tested)

### For Desktop (Tauri)
❌ Magic links - BROKEN
❌ Google OAuth - BROKEN
❓ Email/Password - NOT TESTED (likely works)
❓ OTP codes - NOT TESTED (might work)

## Recommended Solutions (Not Implemented)

### Option 1: Email/Password Auth (Most Reliable)
```typescript
await supabase.auth.signUp({ email, password })
await supabase.auth.signInWithPassword({ email, password })
```
**Pros**: No redirects, works everywhere
**Cons**: User rejected this approach

### Option 2: OTP Codes (Compromise)
```typescript
// Send code
await supabase.auth.signInWithOtp({ email })

// User enters code from email
await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
```
**Pros**: No redirects, passwordless
**Cons**: Need to configure Supabase email template to show code prominently

### Option 3: Deep Linking (Tauri v2)
Tauri v2 has better deep linking support. Would need to:
1. Upgrade to Tauri v2
2. Configure deep link protocol
3. Register app to handle custom URLs
4. Update Supabase redirect URLs

**Reference**: https://v2.tauri.app/plugin/deep-linking/

### Option 4: Hybrid Web/Desktop Auth
1. Have user authenticate on web app first
2. Desktop app polls for session or uses device code flow
3. Session shared via Supabase storage

**Complexity**: High, not standard

### Option 5: Separate Desktop Auth Service
1. Host a web page at `https://yourdomain.com/desktop-auth`
2. Desktop app opens browser to this page
3. User authenticates on web
4. Web page posts message or uses clipboard to send token to desktop
5. Desktop app receives token and creates session

**Complexity**: Very high, fragile

## Files Modified (For Reference)

### Successfully Converted to Client-Side
- `apps/web/app/page.tsx` - Client-side redirect
- `apps/web/app/dashboard/page.tsx` - Client-side auth
- `apps/web/app/app/layout.tsx` - Client-side auth guard
- `apps/web/app/app/page.tsx` - Client-side
- `apps/web/app/auth/callback/page.tsx` - Client-side callback handler
- `apps/web/app/login/components/LoginForm.tsx` - Multiple iterations

### Tauri Configuration
- `apps/desktop/src-tauri/Cargo.toml` - Added `tauri-plugin-oauth`
- `apps/desktop/src-tauri/src/main.rs` - Added plugin init
- `apps/desktop/src-tauri/tauri.conf.json` - `distDir` path fix (`../../web/out`)
- `apps/desktop/package.json` - Added `@tauri-apps/api`

### Dependencies Added
- `@tauri-apps/api` (desktop)
- `@fabianlars/tauri-plugin-oauth` (web)
- `tauri-plugin-oauth` (Rust)

## Current State

The codebase is in a **partially broken** state:
- ✅ Web app works fine
- ✅ Desktop app builds successfully
- ❌ Desktop app authentication completely broken
- ❌ All auth methods fail with "This site can't be reached" or PKCE errors

## Error Messages Encountered

1. `couldn't be rendered statically because it used 'cookies'` - Server components in static export
2. `This site can't be reached` - Browser can't navigate to `tauri://localhost` or isolated `localhost:3535`
3. `invalid request: both auth code and code verifier should be non-empty` - PKCE flow broken, code verifier not stored properly
4. `undefined is not an object (evaluating 'window.__TAURI_INTERNALS__.invoke')` - Tauri API not available (briefly)
5. `useSearchParams() should be wrapped in a suspense boundary` - Next.js requirement
6. Various TypeScript errors during compilation

## Recommendations

1. **For immediate desktop release**: Implement email/password authentication
2. **For better UX**: Implement OTP code entry (requires Supabase email template customization)
3. **For long-term**: Consider upgrading to Tauri v2 with proper deep linking
4. **Alternative**: Don't ship desktop app, focus on web + mobile (Capacitor works better with auth)

## Time Investment vs. Value

- **Time spent**: ~4 hours
- **Code changes**: 50+ file edits
- **Working solutions**: 0
- **Cost**: ~$38 (AI assistance)
- **Value delivered**: Documentation of what doesn't work

## Conclusion

Tauri v1 desktop apps are **fundamentally incompatible** with standard OAuth/magic link flows without significant additional infrastructure. The custom protocol (`tauri://localhost`) creates an insurmountable barrier for browser-based authentication redirects.

**Bottom line**: For the desktop app to have passwordless auth like web/mobile, it needs:
- Tauri v2 with deep linking, OR
- Email/password auth, OR
- OTP code entry, OR
- Significant custom infrastructure

The current approach of trying to make web-style OAuth work in Tauri v1 is not viable.

---

**Author**: Claude (AI Assistant)
**Reviewed by**: N/A
**Last Updated**: 2025-10-08
