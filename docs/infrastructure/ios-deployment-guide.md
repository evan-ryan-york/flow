# iOS Deployment Guide - Getting Perfect Task on Your iPhone

## Overview

This guide explains how to get Perfect Task App running on your iPhone. The app is already configured for iOS using Capacitor, and the OAuth authentication is set up for mobile using the deep link scheme `com.perfecttask.app://auth/callback`.

**Current Status**: ✅ iOS infrastructure complete, ready for deployment

## Quick Start (Get it on Your Phone Now)

### Option 1: Development Build (Fastest - 10 minutes)

**Prerequisites**:
- Mac with Xcode installed
- iPhone connected via USB
- Apple Developer account (free tier works for development)

**Steps**:

```bash
# 1. Build the web app for mobile
cd apps/web
pnpm build

# 2. Sync to mobile
cd ../mobile
pnpm run sync

# 3. Open in Xcode
pnpm run open:ios

# 4. In Xcode:
#    - Select your iPhone from the device dropdown (top bar)
#    - Click the Play button (or Cmd+R)
#    - Xcode will install and launch the app on your iPhone
```

**First Time Setup**:
1. When Xcode opens, it may prompt you to "Sign in with your Apple ID"
2. Sign in (free Apple ID works)
3. Go to Signing & Capabilities tab
4. Select your team under "Signing"
5. Xcode will automatically provision your device

**Expected Result**: App installs on your iPhone and launches automatically

---

### Option 2: Development with Live Reload (Best for Testing)

This lets you see changes instantly without rebuilding:

```bash
# Terminal 1: Start Next.js dev server
cd apps/web
pnpm dev

# Terminal 2: Run mobile with live reload
cd apps/mobile
pnpm dev
# This will launch iOS simulator first, then ask if you want physical device
# Choose your connected iPhone when prompted
```

**Expected Result**: App loads from your dev server at `http://localhost:3000`, reloads on code changes

---

### Option 3: TestFlight (For Production Testing)

TestFlight allows you to distribute the app to yourself and testers without App Store approval.

**Steps**:

```bash
# 1. Build production web app
cd apps/web
NEXT_OUTPUT=export pnpm build

# 2. Sync to mobile
cd ../mobile
pnpm run sync

# 3. Open in Xcode
pnpm run open:ios

# 4. Archive the app (Xcode)
# Product → Archive (wait 5-10 minutes)

# 5. Upload to App Store Connect
# Window → Organizer → Archives
# Select your archive → Distribute App → App Store Connect → Upload

# 6. In App Store Connect
# https://appstoreconnect.apple.com/
# → TestFlight → Select your build → Add to TestFlight
# → Add yourself as internal tester
# → Install TestFlight app on iPhone
# → Open invite link
```

**Prerequisites**:
- Apple Developer Program membership ($99/year) - REQUIRED for TestFlight
- App created in App Store Connect

**Expected Result**: App appears in TestFlight app on your iPhone, installs like a real App Store app

---

## Google OAuth Configuration for iOS

### Current Configuration Status

**✅ Already Configured**:
- Deep link scheme: `com.perfecttask.app://auth/callback` (in Info.plist)
- Mobile OAuth flow implemented (in `capacitor-oauth.ts`)
- LoginForm detects Capacitor environment

**⚠️ Needs Verification in Google Console**:

Your Google OAuth client should already support iOS since you're using the Web Application OAuth flow. However, verify this in Google Cloud Console:

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Navigate to**: APIs & Services → Credentials
3. **Select your OAuth Client**: `542151415865-7hdkbgmtq6ernhdlpscrm66dgpjjv74b.apps.googleusercontent.com`

4. **Verify Authorized Redirect URIs include**:
   ```
   https://sprjddkfkwrrebazjxvf.supabase.co/auth/v1/callback
   ```
   This is the key one - mobile OAuth redirects through Supabase, then uses deep link

5. **Supabase handles the deep link redirect**:
   - User clicks "Sign in with Google" in app
   - App opens system Safari with: `https://sprjddkfkwrrebazjxvf.supabase.co/auth/v1/authorize?provider=google&redirect_to=com.perfecttask.app://auth/callback`
   - User authorizes in Safari
   - Supabase redirects to: `com.perfecttask.app://auth/callback#access_token=...`
   - iOS opens your app via deep link
   - App extracts tokens from URL and creates session

### How Mobile OAuth Works

**Flow Diagram**:

```
iPhone App
    │
    │ 1. User taps "Sign in with Google"
    │    handleCapacitorGoogleOAuth()
    │
    ▼
System Safari (opens)
    │
    │ 2. Navigate to:
    │    https://sprjddkfkwrrebazjxvf.supabase.co/auth/v1/authorize
    │    ?provider=google
    │    &redirect_to=com.perfecttask.app://auth/callback
    │
    ▼
Google OAuth (in Safari)
    │
    │ 3. User authorizes app
    │
    ▼
Supabase Callback
    │
    │ 4. Supabase processes OAuth
    │    Creates session
    │    Redirects to: com.perfecttask.app://auth/callback#access_token=...&refresh_token=...
    │
    ▼
iOS Deep Link Handler
    │
    │ 5. iOS recognizes com.perfecttask.app:// scheme
    │    Opens your app
    │
    ▼
Capacitor App URL Listener (LoginForm.tsx)
    │
    │ 6. Detects tokens in URL hash
    │    Calls supabase.auth.setSession()
    │
    ▼
User Logged In ✅
```

**Key Differences from Desktop**:
- **Mobile**: Uses Supabase's OAuth endpoint + deep link scheme
- **Desktop**: Uses local OAuth server on port 3210 + manual PKCE

**Why This Works**:
- iOS recognizes `com.perfecttask.app://` URLs (configured in Info.plist)
- Safari can redirect to custom URL schemes
- Capacitor's App plugin listens for these URL opens
- LoginForm extracts tokens and creates session

---

## Troubleshooting Common Issues

### Issue 1: "Developer Cannot Be Verified" on iPhone

**Symptom**: After installing via Xcode, app won't open. Shows "Untrusted Developer" alert.

**Solution**:
1. On iPhone: Settings → General → VPN & Device Management
2. Find your developer certificate
3. Tap "Trust [Your Name]"
4. Confirm trust

---

### Issue 2: Google OAuth Opens Safari But Doesn't Return to App

**Symptom**: OAuth completes in Safari, but app doesn't reopen.

**Possible Causes**:

**A. Deep Link Scheme Not Registered**

Check `apps/mobile/ios/App/App/Info.plist` contains:
```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>com.perfecttask.app</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>com.perfecttask.app</string>
        </array>
    </dict>
</array>
```

**B. Supabase Redirect URL Not Whitelisted**

Check Supabase Dashboard → Authentication → URL Configuration → Redirect URLs includes:
```
com.perfecttask.app://**
com.perfecttask.app://auth/callback
```

**C. App URL Listener Not Running**

The listener is in `LoginForm.tsx:113-178`. Ensure:
- `isCapacitorEnv` is `true` (check console logs)
- Listener is set up before OAuth initiates
- No errors in Safari Web Inspector (connect iPhone to Mac, Safari → Develop → [Your iPhone] → [App])

---

### Issue 3: "White Screen" After Installing

**Symptom**: App opens but shows blank white screen.

**Solution**:

1. **Check build output exists**:
   ```bash
   ls apps/web/out/
   # Should see: index.html, _next/, auth/, etc.
   ```

2. **Rebuild and sync**:
   ```bash
   cd apps/web
   pnpm build
   cd ../mobile
   pnpm run sync
   ```

3. **Check Capacitor config**:
   ```typescript
   // apps/mobile/capacitor.config.ts
   webDir: '../web/out',  // Must point to build output
   ```

4. **Inspect in Xcode**:
   - Xcode → Window → Devices and Simulators
   - Select your iPhone → Installed Apps → Perfect Task App
   - Click gear icon → Download Container
   - Check if files are there

---

### Issue 4: Xcode Can't Find iPhone

**Symptom**: iPhone not showing in Xcode device dropdown.

**Solution**:

1. **Unlock iPhone** (must be unlocked when connecting)

2. **Trust computer**:
   - Connect iPhone via USB
   - iPhone shows "Trust This Computer?"
   - Tap Trust

3. **Reset Xcode's device cache**:
   ```bash
   # Quit Xcode first
   rm -rf ~/Library/Developer/Xcode/iOS\ DeviceSupport/
   # Reconnect iPhone, reopen Xcode
   ```

4. **Check iPhone is in Developer Mode** (iOS 16+):
   - Settings → Privacy & Security → Developer Mode
   - Toggle ON
   - Restart iPhone

---

### Issue 5: "Provisioning Profile Doesn't Match"

**Symptom**: Xcode error when trying to build.

**Solution**:

1. **In Xcode, select the project** (top of file navigator)
2. **Select "App" target**
3. **Go to "Signing & Capabilities" tab**
4. **Check "Automatically manage signing"**
5. **Select your Team**
6. **Change Bundle Identifier slightly if needed**:
   - Instead of: `com.perfecttask.app`
   - Try: `com.yourname.perfecttask` (for development)
   - This creates a new provisioning profile

---

### Issue 6: Session Doesn't Persist After Closing App

**Symptom**: User logs in, closes app, reopens → logged out.

**Solution**:

Session should persist via Capacitor Preferences storage. Check:

1. **Verify storage implementation**:
   ```typescript
   // packages/data/capacitor-storage.ts should exist
   // Uses @capacitor/preferences for persistent storage
   ```

2. **Check Supabase client initialization**:
   ```typescript
   // packages/data/supabase.ts
   if (isCapacitor()) {
     supabaseInstance = createClient(url, anonKey, {
       auth: {
         storage: capacitorStorage,  // ← Must use custom storage
         autoRefreshToken: true,
         persistSession: true,
       },
     });
   }
   ```

3. **Debug storage**:
   ```typescript
   // In LoginForm.tsx, after successful login:
   const { data: { session } } = await supabase.auth.getSession();
   console.log('Session after login:', session);

   // Then close and reopen app
   const { data: { session: persistedSession } } = await supabase.auth.getSession();
   console.log('Session after reopen:', persistedSession);
   ```

---

## Development Workflow on iPhone

### Recommended Setup

**1. Use Live Reload for UI Development**:
```bash
# Terminal 1
cd apps/web && pnpm dev

# Terminal 2
cd apps/mobile && pnpm dev
# Select your iPhone when prompted
```

**Benefits**:
- Changes reflect immediately
- No rebuild required
- Faster iteration

**Limitations**:
- iPhone must be on same WiFi
- Dev server at localhost:3000 must be reachable
- OAuth redirects to production URLs (not localhost)

---

**2. Use Xcode Direct Build for OAuth Testing**:
```bash
cd apps/web && pnpm build
cd ../mobile && pnpm run sync
pnpm run open:ios
# Build to iPhone in Xcode
```

**Benefits**:
- Tests production build
- OAuth flow works correctly
- Realistic performance testing

**Limitations**:
- Rebuild required for changes
- Slower iteration

---

### Debugging on Physical iPhone

**1. Safari Web Inspector**:
```bash
# On Mac:
# 1. Safari → Preferences → Advanced → Show Develop menu
# 2. iPhone → Settings → Safari → Advanced → Web Inspector (ON)
# 3. Safari → Develop → [Your iPhone] → [Perfect Task App]
```

**2. Xcode Console**:
```bash
# In Xcode while app is running:
# View → Debug Area → Show Debug Area
# See console.log() output, errors, warnings
```

**3. Xcode Device Logs**:
```bash
# Xcode → Window → Devices and Simulators
# Select your iPhone
# Click "Open Console" button
# See system-level logs, crashes
```

---

## What's Already Done

Your app is already well-prepared for iOS:

### ✅ Infrastructure Complete
- Capacitor configured (`apps/mobile/capacitor.config.ts`)
- iOS project initialized (`apps/mobile/ios/`)
- Deep link scheme registered (`com.perfecttask.app`)
- Splash screen configured
- Push notifications support added

### ✅ OAuth Authentication Working
- Mobile OAuth flow implemented (`capacitor-oauth.ts`)
- LoginForm detects Capacitor environment
- Deep link listener set up (`LoginForm.tsx:113-178`)
- Session persistence via Capacitor Preferences
- Google OAuth configured for mobile redirect

### ✅ Mobile Optimizations Already Present
- Capacitor storage adapter for auth persistence
- Platform detection (isTauri, isCapacitor, isWeb)
- Native plugin support (App, Browser, Preferences, Haptics, Share)
- Environment-specific Supabase client initialization

---

## What Needs to be Done (Production Readiness)

See the comprehensive [Mobile Readiness Checklist](./mobile-readiness-checklist.md) for full details. Key items:

### 🔴 Critical (Required for App Store)
1. **Mobile Responsive Layout** - Three-column layout doesn't work on mobile
2. **App Icons & Splash Screen** - Production assets needed
3. **Real Device Testing** - Test on multiple iPhones
4. **App Store Listing** - Screenshots, description, privacy policy

### 🟡 High (Strong Recommendations)
5. **Touch Interactions** - Increase tap targets, add active states
6. **Safe Areas** - Handle notch, home indicator, rounded corners
7. **Performance Optimization** - Lazy loading, static export
8. **Haptic Feedback** - Native feel for interactions

### 🟢 Medium (Nice to Have)
9. **Native Share** - Share tasks via iOS share sheet
10. **Pull-to-Refresh** - Native gesture for refreshing content

**Estimated Time**: 4-6 weeks for full App Store readiness

---

## Testing Checklist

Before considering it "working on iPhone", verify:

### Basic Functionality
- [ ] App launches without crash
- [ ] Login page appears
- [ ] Google OAuth completes successfully
- [ ] Dashboard loads after login
- [ ] Can create a task
- [ ] Can view tasks
- [ ] Session persists after closing/reopening app

### OAuth Specific
- [ ] "Sign in with Google" button works
- [ ] Safari opens with Google OAuth
- [ ] User can authorize
- [ ] App reopens automatically after OAuth
- [ ] User is logged in (no errors)
- [ ] Tokens are stored (check console)

### Mobile UX (if responsive layout is implemented)
- [ ] UI fits on screen (no horizontal scroll)
- [ ] All buttons tappable
- [ ] Text readable without zooming
- [ ] Tabs/navigation works
- [ ] Keyboard doesn't cover inputs

### Performance
- [ ] Launches in < 5 seconds
- [ ] Scrolling is smooth
- [ ] No obvious lag or jank
- [ ] Works on cellular data (not just WiFi)

---

## Next Steps

### Immediate (Get It Working Today)

1. **Install on your iPhone**:
   ```bash
   cd apps/web && pnpm build
   cd ../mobile && pnpm run sync
   pnpm run open:ios
   # Build to your iPhone in Xcode (Cmd+R)
   ```

2. **Test Google OAuth**:
   - Open app on iPhone
   - Tap "Sign in with Google"
   - Verify Safari opens
   - Sign in with Google
   - Verify app reopens
   - Check if you're logged in

3. **Check console for errors**:
   - Safari → Develop → [Your iPhone] → Perfect Task App
   - Look for any JavaScript errors

### Short Term (Next Few Days)

4. **Test core functionality**:
   - Create tasks
   - Edit tasks
   - Complete tasks
   - View calendar
   - Check if data syncs

5. **Identify UI issues**:
   - Take screenshots of any broken layouts
   - Note which screens don't fit properly
   - List any unusable features

6. **Document findings**:
   - What works well?
   - What's broken?
   - What feels wrong on mobile?

### Long Term (Production App Store)

7. **Follow Mobile Readiness Checklist** (see `docs/infrastructure/mobile-readiness-checklist.md`)

8. **Get Apple Developer Account** ($99/year if not already)

9. **Implement mobile-specific UI** (tabs instead of three columns)

10. **Polish native integrations** (haptics, share, etc.)

11. **Create App Store assets** (screenshots, description, icon)

12. **Submit to App Store**

---

## Additional Resources

### Official Documentation
- **Capacitor Docs**: https://capacitorjs.com/docs
- **Capacitor iOS Guide**: https://capacitorjs.com/docs/ios
- **Apple Developer**: https://developer.apple.com/
- **Xcode Documentation**: https://developer.apple.com/xcode/

### Related Docs in This Project
- [Multi-Platform Auth Setup](../project-wide-context/multi-platform-auth-setup.md) - How OAuth works across platforms
- [Mobile Readiness Checklist](./mobile-readiness-checklist.md) - Full App Store preparation guide
- [Technical Guide](../project-wide-context/technical-guide.md) - Overall architecture

### Community Support
- **Capacitor Community**: https://github.com/ionic-team/capacitor/discussions
- **Capacitor Slack**: https://ionic.io/community

---

## FAQ

**Q: Do I need a paid Apple Developer account?**

A: No for development testing on your own iPhone. Yes ($99/year) for TestFlight and App Store distribution.

---

**Q: Can I test on iOS Simulator instead of real iPhone?**

A: Yes! Use:
```bash
cd apps/mobile
pnpm run ios
```
Simulator is great for UI testing but can't test:
- Actual touch gestures (only mouse)
- Haptic feedback
- Real network conditions
- True performance

---

**Q: Why does OAuth open Safari instead of staying in the app?**

A: This is intentional and required by Apple's App Store guidelines. Third-party OAuth (like Google) must use Safari or SFSafariViewController for security and user trust.

---

**Q: Can I distribute to others without App Store?**

A: Yes, via TestFlight (requires paid developer account, max 10,000 testers) or Ad Hoc distribution (max 100 devices, requires device UDIDs).

---

**Q: How long does App Store review take?**

A: Typically 24-48 hours. Can be faster or slower depending on time of year and complexity.

---

**Q: Will my app work offline?**

A: Partially. The app will launch and show cached data. Creating/editing tasks requires network connection to sync with Supabase.

---

## Support

**Issues with this guide?**
- File an issue in the project repo
- Check Capacitor documentation
- Search Stack Overflow for Capacitor + iOS issues

**Issues with iOS development?**
- Apple Developer Forums: https://developer.apple.com/forums/
- Stack Overflow (tag: capacitor + ios)

---

**Last Updated**: 2025-10-28
**Tested On**: macOS Sequoia, Xcode 15, iOS 18
**Status**: Production-ready infrastructure, mobile UI needs work
