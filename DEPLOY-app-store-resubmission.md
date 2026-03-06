# App Store Resubmission — Deploy Guide for Agent

**Date**: 2026-03-04
**Project root**: `/Users/ryanyork/Software/Flow/flow-app`
**Branch**: `main`

---

## Background — What Was Done and Why

The iOS app was rejected from the App Store for three guideline violations:

1. **Guideline 4.8 (Sign in with Apple)** — Required because Google sign-in is offered
2. **Guideline 4.0 (In-app auth)** — Google OAuth was redirecting to Safari via `window.location.href`; must stay in-app
3. **Guideline 5.1.1 (Account deletion)** — Required because the app supports account creation

All **code changes** are complete and merged to `main`. The build (`pnpm build`) and lint pass with zero errors. Tests pass (182/183 — 1 pre-existing failure in `CalendarPicker`, unrelated).

### What was changed (code — already done, do NOT redo):

| File | Change |
|------|--------|
| `packages/data/services/authService.ts` | Added `signInWithAppleIdToken()` and `deleteAccount()` functions |
| `packages/data/hooks/useAuth.ts` | Added `useSignInWithAppleIdToken` and `useDeleteAccount` hooks |
| `apps/web/lib/capacitor-oauth.ts` | Rewrote to use native `@codetrix-studio/capacitor-google-auth` SDK instead of Safari redirect |
| `apps/web/app/login/components/LoginForm.tsx` | Removed deep link/URL parsing flow, added native Google SDK exchange, added Apple sign-in button + handler, added shared `storeCapacitorSession()` helper |
| `apps/web/components/ProfileMenu.tsx` | Added "Delete Account" button with AlertDialog confirmation (type "DELETE" to confirm) |
| `apps/web/components/mobile/MobileAccountView.tsx` | Added "Delete Account" button with AlertDialog confirmation (type "DELETE" to confirm) |
| `apps/mobile/capacitor.config.ts` | Added `GoogleAuth` plugin config (placeholder `serverClientId` needs replacing) |
| `apps/mobile/package.json` | Added `@capacitor-community/apple-sign-in@6.0.0` and `@codetrix-studio/capacitor-google-auth` |
| `supabase/migrations/20260304000000_add_delete_user_account.sql` | Created `delete_user_data()` PL/pgSQL function (SECURITY DEFINER) that deletes all user data across all tables in FK-safe order |
| `supabase/functions/delete-account/index.ts` | Deno edge function that verifies JWT, calls `delete_user_data()` RPC, then `auth.admin.deleteUser()` |

### What this doc covers (remaining work — your job):

The code is done but cannot deploy because several **manual configuration steps** and **infrastructure deployments** must happen first. Steps 1–4 require human interaction with Xcode/dashboards (flag these to the user). Steps 5–8 can be executed by an agent with shell access.

---

## Project Context

- **Monorepo**: pnpm workspaces + Turborepo
- **App bundle ID**: `com.perfecttask.app`
- **Supabase project**: `sprjddkfkwrrebazjxvf` (hosted at `https://sprjddkfkwrrebazjxvf.supabase.co`)
- **Web hosting**: Vercel (auto-deploys on push to `main`)
- **iOS build**: Fastlane from `apps/mobile/ios/` — `fastlane release` lane uploads to App Store Connect
- **Deploy script**: `./deploy.sh` at project root (interactive, uses `read -p` prompts)
- **Current version**: `1.0.28` (in root `package.json`)
- **Capacitor version**: 6.x (NOT 7 — plugins must be Cap 6 compatible)
- **Node/pnpm**: Use `pnpm` for all package management. Run commands from project root.

### Key env vars (should be in `.env` at project root):
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` — Google OAuth **web** client ID
- `DATABASE_PASSWORD` — Supabase Postgres password (for psql migrations)
- `APP_STORE_CONNECT_API_KEY_KEY_ID` — Fastlane API key ID
- `APP_STORE_CONNECT_API_KEY_ISSUER_ID` — Fastlane API issuer
- `APP_STORE_CONNECT_API_KEY_KEY` — Fastlane API key (base64-encoded .p8)

---

## Step 1: Fix Xcode Toolchain (HUMAN — requires Xcode GUI/install)

`npx cap sync ios` currently fails because `xcodebuild` can't load `IDESimulatorFoundation`. Fix:

```bash
xcodebuild -runFirstLaunch
```

Verify:
```bash
xcodebuild -version
# Should print Xcode version without errors
```

---

## Step 2: Configure Google Native Auth (HUMAN — requires Xcode GUI + Google Cloud Console)

### 2A. Get your Google OAuth Web Client ID

The value of `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` from your `.env` file. This is the **web** client ID (not iOS). It looks like `123456789-xxxxx.apps.googleusercontent.com`.

### 2B. Update `capacitor.config.ts`

File: `apps/mobile/capacitor.config.ts`, line 15.

Replace:
```typescript
serverClientId: 'YOUR_GOOGLE_OAUTH_CLIENT_ID',
```

With the actual web client ID value from step 2A.

**Important**: This must be the **web** client ID, not the iOS client ID. The native Google SDK uses it to request an ID token that Supabase can verify.

### 2C. Add `GoogleService-Info.plist` to Xcode

1. Google Cloud Console → APIs & Services → Credentials
2. Find or create an **iOS** OAuth client for bundle ID `com.perfecttask.app`
3. Download `GoogleService-Info.plist`
4. Open `apps/mobile/ios/App/App.xcodeproj` in Xcode
5. Drag `GoogleService-Info.plist` into the `App/App/` group in the project navigator
6. Check "Copy items if needed" in the dialog

### 2D. Add Reversed Client ID URL Scheme in Xcode

1. Open the `GoogleService-Info.plist` you just added — find the `REVERSED_CLIENT_ID` value (looks like `com.googleusercontent.apps.123456789-xxxxx`)
2. In Xcode: select App target → Info tab → URL Types section → click `+`
3. Set **URL Schemes** to the `REVERSED_CLIENT_ID` value
4. Leave Role as "Editor"

---

## Step 3: Configure Sign in with Apple (HUMAN — requires Apple Developer Portal + Supabase Dashboard + Xcode)

### 3A. Apple Developer Portal

1. Go to https://developer.apple.com/account/resources/identifiers
2. Find App ID `com.perfecttask.app` → click it → enable "Sign in with Apple" → Save
3. Go to https://developer.apple.com/account/resources/authkeys/list
4. Create a new key → check "Sign in with Apple" → Configure → select `com.perfecttask.app` as the Primary App ID → Save → Continue → Register
5. Download the `.p8` key file — note the **Key ID** shown on the page
6. Note your **Team ID** (shown in top-right corner of the developer portal)

### 3B. Supabase Dashboard — Enable Apple Provider

1. Go to https://supabase.com/dashboard/project/sprjddkfkwrrebazjxvf/auth/providers
2. Find **Apple** → toggle Enable
3. Fill in:
   - **Service ID (for OAuth)**: Create one at Apple Developer → Identifiers → Services IDs → Register a new identifier with ID `com.perfecttask.app.signin`, enable "Sign in with Apple", configure web domain + return URL `https://sprjddkfkwrrebazjxvf.supabase.co/auth/v1/callback`
   - **Team ID**: from step 3A.6
   - **Key ID**: from step 3A.5
   - **Private Key**: paste the full contents of the `.p8` file (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)
4. Save

### 3C. Xcode — Add Capability

1. Open `apps/mobile/ios/App/App.xcodeproj` in Xcode
2. Select the **App** target in the left sidebar
3. Go to **Signing & Capabilities** tab
4. Click `+ Capability` (top left) → search for "Sign in with Apple" → double-click to add

---

## Step 4: Sync Capacitor (AGENT or HUMAN — shell command, but depends on Steps 1-3)

After all Xcode/dashboard configuration is complete:

```bash
cd /Users/ryanyork/Software/Flow/flow-app/apps/mobile && npx cap sync ios
```

**Expected output**: Should complete with all checkmarks. Verify these pods appear in the output:
- `CapacitorCommunityAppleSignIn`
- `CapacitorGoogleAuth` (from `@codetrix-studio/capacitor-google-auth`)

If `pod install` fails:
```bash
cd /Users/ryanyork/Software/Flow/flow-app/apps/mobile/ios/App && pod install --repo-update
```

---

## Step 5: Deploy Database Migration (AGENT — shell command)

**Requires**: `$DATABASE_PASSWORD` env var set.

```bash
psql "postgresql://postgres:$DATABASE_PASSWORD@db.sprjddkfkwrrebazjxvf.supabase.co:5432/postgres" \
  -f /Users/ryanyork/Software/Flow/flow-app/supabase/migrations/20260304000000_add_delete_user_account.sql
```

**Verify** the function was created:
```bash
psql "postgresql://postgres:$DATABASE_PASSWORD@db.sprjddkfkwrrebazjxvf.supabase.co:5432/postgres" \
  -c "SELECT proname FROM pg_proc WHERE proname = 'delete_user_data';"
```

Expected: one row with `delete_user_data`.

---

## Step 6: Deploy Edge Function (AGENT — shell command)

```bash
cd /Users/ryanyork/Software/Flow/flow-app && npx supabase functions deploy delete-account --project-ref sprjddkfkwrrebazjxvf
```

**Verify** it's deployed:
```bash
curl -s -o /dev/null -w "%{http_code}" \
  https://sprjddkfkwrrebazjxvf.supabase.co/functions/v1/delete-account
```

Expected: HTTP `401` (unauthorized — correct, means the function exists and is rejecting unauthenticated requests).

---

## Step 7: Deploy Web + iOS (AGENT or HUMAN — interactive shell command)

The deploy script handles version bumping, building, and uploading. It is **interactive** (`read -p` prompts).

```bash
cd /Users/ryanyork/Software/Flow/flow-app
./deploy.sh --web --ios-release --patch --skip-checks
```

When prompted `Proceed? [y/N]:`, enter `y`.

**What the script does in order:**
1. Bumps version `1.0.28` → `1.0.29` in all `package.json` files, `project.pbxproj`, `tauri.conf.json`, `Cargo.toml`
2. Runs `pnpm build:web:export` (Next.js static export for Capacitor)
3. Runs `pnpm sync` in `apps/mobile` (Capacitor sync)
4. Increments `CURRENT_PROJECT_VERSION` in `project.pbxproj`
5. Runs `fastlane release` from `apps/mobile/ios/` (builds IPA, uploads to App Store Connect)
6. Commits all changes, pushes to `main` (triggers Vercel auto-deploy for web)

**If the deploy script can't be run non-interactively**, execute the steps manually:

```bash
cd /Users/ryanyork/Software/Flow/flow-app

# 1. Version bump (manual)
node -e "const fs=require('fs'); for(const p of ['package.json','apps/web/package.json','apps/desktop/package.json','apps/mobile/package.json']){const pkg=JSON.parse(fs.readFileSync(p));pkg.version='1.0.29';fs.writeFileSync(p,JSON.stringify(pkg,null,2)+'\n')}"
sed -i '' 's/MARKETING_VERSION = .*/MARKETING_VERSION = 1.0.29;/g' apps/mobile/ios/App/App.xcodeproj/project.pbxproj

# 2. Build web export
pnpm build:web:export

# 3. Sync capacitor
cd apps/mobile && pnpm sync && cd ../..

# 4. Increment iOS build number
CURRENT_BUILD=$(grep -m1 "CURRENT_PROJECT_VERSION" apps/mobile/ios/App/App.xcodeproj/project.pbxproj | sed 's/.*= \([0-9]*\);/\1/')
NEW_BUILD=$((CURRENT_BUILD + 1))
sed -i '' "s/CURRENT_PROJECT_VERSION = [0-9]*;/CURRENT_PROJECT_VERSION = $NEW_BUILD;/g" apps/mobile/ios/App/App.xcodeproj/project.pbxproj

# 5. Build and upload iOS
cd apps/mobile/ios && fastlane release && cd ../../..

# 6. Commit and push (triggers Vercel deploy)
git add -A
git commit -m "chore: release v1.0.29 with App Store auth fixes

- Sign in with Apple support
- Native in-app Google authentication (no Safari redirect)
- Account deletion feature

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push origin main
```

---

## Step 8: Submit for Review in App Store Connect (HUMAN — web UI)

1. Go to https://appstoreconnect.apple.com/apps
2. Select the **Flow** app
3. Go to **App Store** tab
4. Create a new version `1.0.29` (or select existing draft)
5. Wait ~15 minutes for the uploaded build to finish processing
6. Select the new build
7. Fill in **What's New in This Version**:
   ```
   - Added Sign in with Apple
   - Improved authentication experience (stays in-app)
   - Added account deletion option in Account settings
   ```
8. Click **Submit for Review**

---

## Troubleshooting

### `xcodebuild -runFirstLaunch` doesn't fix `cap sync`
Try reinstalling Xcode command line tools:
```bash
sudo rm -rf /Library/Developer/CommandLineTools
xcode-select --install
```

### `pod install` fails with deployment target error
The Apple Sign-In plugin v6.0.0 requires iOS 13+. Check `apps/mobile/ios/App/Podfile` has `platform :ios, '13.0'` or higher.

### Fastlane can't find signing certificate
Ensure App Store Connect API key env vars are set in `.env`:
```
APP_STORE_CONNECT_API_KEY_KEY_ID=...
APP_STORE_CONNECT_API_KEY_ISSUER_ID=...
APP_STORE_CONNECT_API_KEY_KEY=... (base64-encoded .p8 contents)
```
Or run `fastlane release` interactively from `apps/mobile/ios/` to use Apple ID authentication.

### Google Sign-In returns error on device
- `GoogleService-Info.plist` must be added **inside the Xcode project** (not just on the filesystem)
- The reversed client ID URL scheme must be registered in Xcode → App target → Info → URL Types
- `serverClientId` in `capacitor.config.ts` must be the **web** client ID, not the iOS client ID

### Apple Sign-In fails with "invalid_client"
- Verify the Service ID `com.perfecttask.app.signin` is configured in Apple Developer portal with the correct web domain and return URL
- Verify the `.p8` private key in Supabase Dashboard matches the Key ID
- Verify "Sign in with Apple" capability is added in Xcode

### Delete account returns HTTP 500
- Check migration was applied: `SELECT proname FROM pg_proc WHERE proname = 'delete_user_data';`
- Check edge function logs: `npx supabase functions logs delete-account --project-ref sprjddkfkwrrebazjxvf`
- Common cause: a table name changed or doesn't exist. The migration uses `calendar_connections` (renamed from `google_calendar_connections` in migration `20251228092617`).

### `pnpm build` fails after changes
Run `pnpm build` from project root. This runs `tsc --noEmit` + `eslint . --max-warnings 0`. As of this writing, it passes cleanly. If it fails, the error output will tell you which file/line has the issue.

### One test fails (`CalendarPicker`)
This is a **pre-existing** failure unrelated to the auth changes. The test `CalendarPicker > renders connections and calendars` has Zod validation errors in its test data. It can be safely ignored for this deployment.
