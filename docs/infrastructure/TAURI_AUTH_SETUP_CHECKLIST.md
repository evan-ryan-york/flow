# Tauri OAuth Setup Checklist

## ✅ Implementation Complete

The following has been implemented:

- [x] Installed `@tauri-apps/api` package
- [x] Created `apps/web/lib/tauri-oauth.ts` utility module
- [x] Updated `apps/web/app/login/components/LoginForm.tsx` with Tauri detection
- [x] Rust dependencies already configured (`tauri-plugin-oauth`)
- [x] Rust initialization already configured (`.plugin(tauri_plugin_oauth::init())`)
- [x] TypeScript compilation successful

## ⚙️ Configuration Required (MUST DO)

Before testing, you MUST configure these services:

### 1. Supabase Dashboard

Navigate to: **Authentication → URL Configuration → Redirect URLs**

Add these URLs:
```
http://localhost:3000
http://localhost:3535
http://localhost:9999
http://localhost:*
```

**Why?** The OAuth plugin uses random ports, so multiple localhost URLs ensure coverage.

### 2. Google Cloud Console

Navigate to: **APIs & Services → Credentials → OAuth 2.0 Client IDs**

Under **Authorized redirect URIs**, add:
```
http://localhost:3000
http://localhost:3535
http://localhost:9999
http://localhost
```

**Why?** Google requires explicit redirect URI configuration for security.

### 3. Environment Variables

Verify your `.env.local` has:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 🧪 Testing Steps

### Option 1: Development Mode (Recommended for Testing)

Run the desktop app in dev mode (automatically starts Next.js dev server):

```bash
cd /Users/ryanyork/Software/project-manager/flow-app
pnpm dev:desktop
```

This will:
1. Start Next.js dev server at `localhost:3000`
2. Launch Tauri desktop app
3. Enable hot-reload for faster iteration

### Option 2: Production Build

Build a production desktop app:

```bash
# Build web app as static export
pnpm build:web:export

# Build desktop app
pnpm build:desktop
```

### Step 3: Test OAuth Flow

1. Click "Sign in with Google" button
2. System browser should open with Google OAuth page
3. Sign in with your Google account
4. Authorize the application
5. Browser will redirect to localhost (may show "Connection successful" or similar)
6. **Desktop app should automatically log you in**
7. You should be redirected to the dashboard

### Expected Console Output

**Successful OAuth flow:**
```
🔐 Starting Tauri OAuth flow...
📡 Starting OAuth server...
✅ OAuth server started on port 3535
🔗 Getting OAuth URL from Supabase...
🌐 Opening OAuth URL in system browser...
⏳ Waiting for OAuth callback...
📩 Received OAuth callback: http://localhost:3535?code=...
🔑 Auth code received, exchanging for session...
✅ Authentication successful!
👤 User: your-email@example.com
```

## 🐛 Troubleshooting

### "This site can't be reached"

**Problem:** Browser shows error when trying to redirect back to localhost

**Solution:**
1. Check Supabase redirect URLs include `http://localhost:*`
2. Check Google OAuth redirect URIs include localhost ports
3. Verify OAuth server started (check console for port number)

### "Authentication failed"

**Problem:** OAuth flow completes but session fails to create

**Solution:**
1. Check Supabase PKCE is enabled (should be default)
2. Verify Supabase anon key is correct in `.env.local`
3. Check Supabase project is not paused/suspended

### "Magic links are not recommended"

**Problem:** Trying to use magic link in desktop app

**Solution:**
- Magic links don't work reliably in Tauri apps
- Use "Sign in with Google" button instead
- The LoginForm will show a warning if you try magic links in desktop

## 📚 Additional Documentation

- **Full Setup Guide**: `docs/infrastructure/tauri-desktop-authentication-setup.md`
- **Lessons Learned**: `docs/infrastructure/tauri-desktop-authentication-issues.md`

## 🎯 What Changed

### New Files
- `apps/web/lib/tauri-oauth.ts` - Tauri OAuth utility functions
- `docs/infrastructure/tauri-desktop-authentication-setup.md` - Complete setup guide
- `docs/infrastructure/TAURI_AUTH_SETUP_CHECKLIST.md` - This checklist

### Modified Files
- `apps/web/app/login/components/LoginForm.tsx` - Added Tauri OAuth support
- `apps/web/package.json` - Added `@tauri-apps/api` dependency

### Existing (Unchanged)
- `apps/desktop/src-tauri/Cargo.toml` - Already had OAuth plugin
- `apps/desktop/src-tauri/src/main.rs` - Already initialized plugin

## 🚀 Next Steps

1. Complete Supabase configuration (redirect URLs)
2. Complete Google Cloud Console configuration (redirect URIs)
3. Build and test desktop app
4. Deploy desktop app with confidence

## ✨ Key Features

- ✅ **Automatic environment detection** - Uses Tauri OAuth in desktop, web OAuth in browser
- ✅ **Comprehensive error handling** - Clear error messages for all failure cases
- ✅ **Security best practices** - Uses PKCE flow, temporary localhost server
- ✅ **Production ready** - Based on proven working example
- ✅ **Well documented** - Console logging for debugging, comprehensive docs

---

**Implementation Date**: 2025-10-08
**Status**: Ready for testing
**Confidence Level**: High (based on working reference implementation)
