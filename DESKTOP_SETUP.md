# Perfect Task Desktop App - Setup & Installation Guide

## Prerequisites

### 1. Install Rust (Required for Tauri)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

After installation, restart your terminal or run:
```bash
source $HOME/.cargo/env
```

Verify installation:
```bash
rustc --version
cargo --version
```

### 2. Install Xcode Command Line Tools (macOS)

```bash
xcode-select --install
```

## Build Process

### Development Build (For Testing)

From the project root:

```bash
cd apps/desktop
pnpm dev
```

This will:
1. Build the Next.js web app
2. Launch the Tauri development window
3. Enable hot-reload for both frontend and backend

### Production Build (For Installation)

From the desktop app directory:

```bash
cd apps/desktop
pnpm build
```

This will create:
- **DMG installer**: `apps/desktop/src-tauri/target/release/bundle/dmg/Perfect Task App_0.1.0_universal.dmg`
- **App bundle**: `apps/desktop/src-tauri/target/release/bundle/macos/Perfect Task App.app`

Build time: ~5-10 minutes (first build), ~2-3 minutes (subsequent builds)

## Installation

### Option 1: From DMG (Recommended)

1. Locate the DMG file:
   ```bash
   open apps/desktop/src-tauri/target/release/bundle/dmg/
   ```

2. Double-click the DMG file
3. Drag "Perfect Task App" to your Applications folder
4. Eject the DMG
5. Open the app from Applications

**Note**: On first launch, you may see a security warning:
- Go to System Preferences → Security & Privacy
- Click "Open Anyway" next to the blocked app message

### Option 2: Direct App Bundle

```bash
cp -r apps/desktop/src-tauri/target/release/bundle/macos/Perfect\ Task\ App.app /Applications/
```

## Current Build Status

✅ **Completed**:
- TypeScript compilation errors fixed
- Tauri app icons generated (all sizes)
- Build configuration verified
- Next.js production build successful

⚠️ **Required Before First Build**:
- Install Rust toolchain (see Prerequisites above)
- Install Xcode Command Line Tools

## Known Issues

1. **ESLint Warning**: Next.js 15 shows an ESLint config warning during build. This is cosmetic and doesn't affect functionality.

2. **First Launch Security**: macOS will block the app on first launch because it's not code-signed. See "Option 1" installation instructions for workaround.

## Code Signing & Distribution (Optional)

For distributing to other users, you'll need:

### 1. Apple Developer Account
- Cost: $99/year
- Sign up at: https://developer.apple.com

### 2. Create Code Signing Certificate

```bash
# Install certificate from Apple Developer portal
# Then update tauri.conf.json:
```

```json
{
  "tauri": {
    "bundle": {
      "macOS": {
        "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)"
      }
    }
  }
}
```

### 3. Notarization (Required for macOS 10.15+)

After signing, notarize with Apple:

```bash
xcrun notarytool submit "path/to/app.dmg" \
  --apple-id "your@email.com" \
  --team-id "YOUR_TEAM_ID" \
  --password "app-specific-password"
```

## App Configuration

### Window Settings
- Default size: 1400x900
- Minimum size: 1200x700
- Resizable: Yes
- Centered on launch

### Permissions
Current allowlist in `tauri.conf.json`:
- ✅ Shell (open external links)
- ✅ Dialog (file open/save)
- ✅ Notifications
- ✅ Global shortcuts
- ✅ File system (read/write/create/remove)

### System Tray
- Enabled with icon in menu bar
- Quick access to app functions

## Troubleshooting

### Build Fails with "command not found: cargo"
**Solution**: Rust not installed. See Prerequisites section.

### "xcrun: error: invalid active developer path"
**Solution**: Install Xcode Command Line Tools:
```bash
xcode-select --install
```

### Build succeeds but app won't open
**Solution**: Check Console.app for errors. Common issues:
- Web server not accessible (check Next.js build completed)
- Port 3000 already in use

### App opens but shows blank screen
**Solution**:
1. Check that `.env.local` exists with Supabase credentials
2. Verify network connection to Supabase
3. Check browser console in development mode

## Development Tips

### Hot Reload
In development mode (`pnpm dev`), changes to:
- React/Next.js code: Hot reloads automatically
- Rust code: Requires app restart (Ctrl+C, then `pnpm dev` again)

### Debugging
```bash
# Development mode with Rust logs
RUST_LOG=debug pnpm dev

# Open browser DevTools in the Tauri window
Right-click → Inspect Element
```

### Clean Build
If you encounter build issues:
```bash
cd apps/desktop/src-tauri
cargo clean
cd ../..
pnpm build
```

## Architecture

```
apps/desktop/
├── src-tauri/
│   ├── Cargo.toml          # Rust dependencies
│   ├── tauri.conf.json     # Tauri configuration
│   ├── icons/              # Generated app icons
│   └── src/
│       └── main.rs         # Rust backend (minimal)
├── package.json            # Build scripts
└── generate-icon.js        # Icon generation script
```

The desktop app is a thin wrapper around the web app:
- Frontend: Next.js app from `apps/web` (compiled to static files)
- Backend: Minimal Rust binary (Tauri runtime)
- Communication: IPC between frontend and Tauri APIs

## Updates

To update the app version:

1. Update version in `apps/desktop/src-tauri/tauri.conf.json`:
   ```json
   {
     "package": {
       "version": "0.2.0"
     }
   }
   ```

2. Update version in `apps/desktop/src-tauri/Cargo.toml`:
   ```toml
   [package]
   version = "0.2.0"
   ```

3. Rebuild:
   ```bash
   pnpm build
   ```

## Next Steps

1. ✅ Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
2. ✅ Install Xcode CLI tools: `xcode-select --install`
3. Run production build: `cd apps/desktop && pnpm build`
4. Install the DMG or copy app to /Applications
5. Launch Perfect Task App from Applications folder

---

**Need Help?**
- Tauri Documentation: https://tauri.app
- GitHub Issues: https://github.com/evan-ryan-york/perfect-task-app/issues
