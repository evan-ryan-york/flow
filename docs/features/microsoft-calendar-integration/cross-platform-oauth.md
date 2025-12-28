# Cross-Platform OAuth for Microsoft Calendar

This document details the OAuth implementation strategies for iOS, macOS Desktop, and Web platforms when connecting Microsoft 365 / Outlook calendars.

## Platform Overview

| Platform | OAuth Method | Callback Mechanism | User Experience |
|----------|-------------|-------------------|-----------------|
| Web | Popup window | `postMessage` to parent | Popup opens, authorizes, closes |
| iOS | In-app browser | Deep link / URL scheme | Browser opens, redirects back to app |
| macOS Desktop | System browser | Custom protocol handler | Browser opens, app regains focus |

---

## Web Implementation

### Flow
1. User clicks "Connect Microsoft Calendar"
2. App opens popup window with Microsoft OAuth URL
3. User authorizes in popup
4. Microsoft redirects to Edge Function callback
5. Edge Function sends `postMessage` to parent window
6. Popup closes, parent window receives connection ID

### Code

**Initiating OAuth (React hook):**
```typescript
export const useConnectMicrosoftCalendar = () => {
  return useMutation({
    mutationFn: async () => {
      const session = await getSessionToken()
      const response = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/microsoft-calendar-oauth?action=initiate`,
        { headers: { Authorization: `Bearer ${session}` } }
      )

      const { authUrl } = await response.json()

      // Open OAuth in popup
      const popup = window.open(
        authUrl,
        'Microsoft OAuth',
        'width=600,height=700,left=200,top=100'
      )

      // Wait for callback via postMessage
      return new Promise((resolve, reject) => {
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'microsoft-calendar-oauth') {
            window.removeEventListener('message', handleMessage)
            popup?.close()

            if (event.data.success) {
              resolve(event.data.connectionId)
            } else {
              reject(new Error(event.data.error))
            }
          }
        }

        window.addEventListener('message', handleMessage)

        // Detect popup close without completing
        const interval = setInterval(() => {
          if (popup?.closed) {
            clearInterval(interval)
            window.removeEventListener('message', handleMessage)
            reject(new Error('OAuth popup was closed'))
          }
        }, 500)
      })
    },
  })
}
```

**Edge Function callback response:**
```typescript
function getCallbackHtml(success: boolean, error?: string, connectionId?: string) {
  return `
<!DOCTYPE html>
<html>
<head><title>Microsoft Calendar</title></head>
<body>
<script>
  if (window.opener) {
    window.opener.postMessage({
      type: 'microsoft-calendar-oauth',
      success: ${success},
      ${connectionId ? `connectionId: '${connectionId}',` : ''}
      ${error ? `error: '${error}',` : ''}
    }, '*');
  }
  window.close();
</script>
<p>${success ? 'Connected! This window will close.' : `Error: ${error}`}</p>
</body>
</html>
  `
}
```

---

## iOS Implementation (Capacitor)

### Flow
1. User taps "Connect Microsoft Calendar"
2. App opens system browser with OAuth URL (using `@capacitor/browser`)
3. User authorizes in browser
4. Microsoft redirects to Edge Function callback
5. Edge Function redirects to app's custom URL scheme
6. iOS opens app via deep link with connection result
7. App handles deep link and stores connection

### Setup

**1. Configure URL Scheme in `capacitor.config.ts`:**
```typescript
const config: CapacitorConfig = {
  appId: 'com.flowapp.app',
  appName: 'Flow',
  plugins: {
    App: {
      // Handle custom URL schemes
    },
  },
}
```

**2. Add URL Scheme to `ios/App/App/Info.plist`:**
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.flowapp.app</string>
    </array>
    <key>CFBundleURLName</key>
    <string>com.flowapp.app</string>
  </dict>
</array>
```

**3. Register redirect URI in Azure AD:**
```
com.flowapp.app://oauth/microsoft/callback
```

### Code

**Opening OAuth browser:**
```typescript
import { Browser } from '@capacitor/browser'
import { App } from '@capacitor/app'

export const connectMicrosoftCalendarIOS = async () => {
  const session = await getSessionToken()

  // Get OAuth URL from Edge Function
  const response = await fetch(
    `${SUPABASE_FUNCTIONS_URL}/microsoft-calendar-oauth?action=initiate&platform=ios`,
    { headers: { Authorization: `Bearer ${session}` } }
  )

  const { authUrl } = await response.json()

  // Open in system browser
  await Browser.open({ url: authUrl })
}
```

**Handling deep link callback:**
```typescript
import { App } from '@capacitor/app'

// Set up listener in app initialization
App.addListener('appUrlOpen', async (event) => {
  const url = new URL(event.url)

  if (url.pathname === '/oauth/microsoft/callback') {
    const success = url.searchParams.get('success') === 'true'
    const connectionId = url.searchParams.get('connectionId')
    const error = url.searchParams.get('error')

    // Close browser
    await Browser.close()

    if (success && connectionId) {
      // Invalidate queries to refresh connections
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] })

      // Navigate to settings or show success toast
      router.push('/app/settings/calendar-connections')
    } else {
      // Show error toast
      toast.error(error || 'Failed to connect Microsoft Calendar')
    }
  }
})
```

**Edge Function iOS redirect:**
```typescript
// In microsoft-calendar-oauth Edge Function
const platform = url.searchParams.get('platform')

if (platform === 'ios') {
  // Redirect to iOS app via custom URL scheme
  const redirectUrl = new URL('com.flowapp.app://oauth/microsoft/callback')
  redirectUrl.searchParams.set('success', 'true')
  redirectUrl.searchParams.set('connectionId', connectionId)

  return Response.redirect(redirectUrl.toString(), 302)
}

// Default: Web popup callback
return new Response(getCallbackHtml(true, null, connectionId), {
  headers: { 'Content-Type': 'text/html' },
})
```

---

## macOS Desktop Implementation (Tauri)

### Flow
1. User clicks "Connect Microsoft Calendar"
2. App opens default browser with OAuth URL
3. User authorizes in browser
4. Microsoft redirects to Edge Function callback
5. Edge Function redirects to Tauri custom protocol
6. macOS opens app via protocol handler
7. App handles callback and stores connection

### Setup

**1. Configure custom protocol in `tauri.conf.json`:**
```json
{
  "tauri": {
    "security": {
      "dangerousUseHttpScheme": true
    },
    "protocol": {
      "scheme": ["tauri"]
    }
  }
}
```

**2. Register protocol handler in `src-tauri/src/main.rs`:**
```rust
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            #[cfg(any(windows, target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link().register_all()?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**3. Register redirect URI in Azure AD:**
```
tauri://localhost/oauth/microsoft/callback
```

### Code

**Opening OAuth browser:**
```typescript
import { open } from '@tauri-apps/plugin-shell'

export const connectMicrosoftCalendarDesktop = async () => {
  const session = await getSessionToken()

  // Get OAuth URL from Edge Function
  const response = await fetch(
    `${SUPABASE_FUNCTIONS_URL}/microsoft-calendar-oauth?action=initiate&platform=desktop`,
    { headers: { Authorization: `Bearer ${session}` } }
  )

  const { authUrl } = await response.json()

  // Open in default browser
  await open(authUrl)
}
```

**Handling protocol callback:**
```typescript
import { onOpenUrl } from '@tauri-apps/plugin-deep-link'

// Set up listener in app initialization
await onOpenUrl((urls) => {
  for (const urlString of urls) {
    const url = new URL(urlString)

    if (url.host === 'localhost' && url.pathname === '/oauth/microsoft/callback') {
      const success = url.searchParams.get('success') === 'true'
      const connectionId = url.searchParams.get('connectionId')
      const error = url.searchParams.get('error')

      if (success && connectionId) {
        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ['calendar-connections'] })

        // Focus app window
        appWindow.setFocus()

        // Show success notification
        sendNotification({
          title: 'Microsoft Calendar Connected',
          body: 'Your calendar is now syncing.',
        })
      } else {
        // Show error
        toast.error(error || 'Failed to connect')
      }
    }
  }
})
```

**Edge Function desktop redirect:**
```typescript
const platform = url.searchParams.get('platform')

if (platform === 'desktop') {
  // Redirect to Tauri app via custom protocol
  const redirectUrl = new URL('tauri://localhost/oauth/microsoft/callback')
  redirectUrl.searchParams.set('success', 'true')
  redirectUrl.searchParams.set('connectionId', connectionId)

  return Response.redirect(redirectUrl.toString(), 302)
}
```

---

## Unified Platform Detection

To automatically use the correct OAuth flow based on platform:

```typescript
import { Capacitor } from '@capacitor/core'

export const detectPlatform = (): 'web' | 'ios' | 'android' | 'desktop' => {
  // Check if running in Tauri
  if (window.__TAURI__) {
    return 'desktop'
  }

  // Check if running in Capacitor
  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform() as 'ios' | 'android'
  }

  return 'web'
}

export const useConnectMicrosoftCalendar = () => {
  const platform = detectPlatform()

  return useMutation({
    mutationFn: async () => {
      switch (platform) {
        case 'ios':
        case 'android':
          return connectMicrosoftCalendarMobile()
        case 'desktop':
          return connectMicrosoftCalendarDesktop()
        default:
          return connectMicrosoftCalendarWeb()
      }
    },
  })
}
```

---

## Security Considerations

### State Token (CSRF Protection)
- All platforms use the same state token mechanism
- Token stored in `oauth_state_tokens` table with 5-minute expiry
- Validated on callback before token exchange

### Token Storage
- **Web**: Tokens stored in Supabase (database)
- **iOS**: Same as web (Supabase) - no local keychain storage needed
- **macOS**: Same as web (Supabase)

### Secure Redirect
- All redirect URIs must be registered in Azure AD
- Custom URL schemes prevent other apps from intercepting
- Always validate `state` parameter matches stored token

---

## Testing Checklist

### Web
- [ ] Popup opens without being blocked
- [ ] OAuth completes successfully
- [ ] `postMessage` received by parent
- [ ] Popup closes automatically
- [ ] Connection appears in list

### iOS Simulator
- [ ] Browser opens with OAuth URL
- [ ] Authorization completes
- [ ] App opens via deep link
- [ ] Connection saved correctly
- [ ] Browser closes after redirect

### iOS Device
- [ ] Same as simulator tests
- [ ] Universal links work (if configured)
- [ ] Background app state handled

### macOS Desktop
- [ ] Default browser opens
- [ ] OAuth completes
- [ ] Protocol handler invokes app
- [ ] App window gains focus
- [ ] Connection saved correctly

---

## Troubleshooting

### iOS: App doesn't open after OAuth
1. Verify URL scheme in `Info.plist`
2. Check redirect URI matches Azure AD registration
3. Ensure `App.addListener` is set up before OAuth starts
4. Check console for deep link handling errors

### macOS: Protocol not recognized
1. Verify Tauri plugin configured correctly
2. Check `tauri.conf.json` has protocol scheme
3. Rebuild app after config changes
4. Check system logs for protocol handler errors

### Web: Popup blocked
1. Ensure OAuth triggered by user action (click)
2. Check browser popup settings
3. Consider fallback to redirect flow

### All Platforms: State token invalid
1. Check token expiry (5 minutes)
2. Verify same Supabase instance for create/validate
3. Check for duplicate OAuth attempts
