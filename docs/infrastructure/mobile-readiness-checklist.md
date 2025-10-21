# Mobile Readiness Checklist - iOS App Store Submission

**Last Updated:** 2025-01-20
**Target Platform:** iOS (via Capacitor)
**Estimated Time to Complete:** 4-6 weeks
**Goal:** Production-ready iOS app approved by Apple App Store

---

## Overview

This checklist transforms your desktop-optimized Next.js app into a mobile-ready iOS application. Each item includes acceptance criteria, implementation guidance, and testing steps.

**Progress Tracking:**
- [ ] 0/10 items completed
- [ ] Ready for TestFlight
- [ ] Ready for App Store submission

---

## ✅ Checklist Items

### 1. Implement Mobile-Responsive Layout

**Priority:** 🔴 **CRITICAL** - Blocking issue for App Store approval

**Current Problem:**
- Three-column layout (192px + 60% + 40%) breaks on mobile screens
- No responsive breakpoints in `ThreeColumnLayout.tsx`
- Unusable on iPhone (375px-430px wide screens)

**What to Build:**

Create a mobile layout that uses tabs or bottom navigation instead of three columns:

```tsx
// ThreeColumnLayout.tsx - Add mobile version
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@perfect-task-app/ui'

export function ThreeColumnLayout({ userId }: Props) {
  const [activeTab, setActiveTab] = useState('tasks')

  return (
    <>
      {/* Mobile Layout (< 768px) */}
      <div className="md:hidden flex flex-col h-screen">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="w-full grid grid-cols-3 rounded-none border-b">
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="flex-1 overflow-auto mt-0">
            <ProjectsPanel userId={userId} {...props} />
          </TabsContent>

          <TabsContent value="tasks" className="flex-1 overflow-auto mt-0">
            <TaskHub userId={userId} {...props} />
          </TabsContent>

          <TabsContent value="calendar" className="flex-1 overflow-auto mt-0">
            <CalendarPanel userId={userId} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop Layout (≥ 768px) - Keep existing */}
      <div className="hidden md:flex h-screen bg-white">
        {/* ... existing three-column code ... */}
      </div>
    </>
  )
}
```

**Implementation Steps:**

1. Install tabs component (if not already):
   ```bash
   cd packages/ui
   pnpm dlx shadcn@latest add tabs
   ```

2. Update `ThreeColumnLayout.tsx` with mobile/desktop variants

3. Test mobile components individually:
   - Ensure `ProjectsPanel` works in tab (full width)
   - Ensure `TaskHub` works in tab (full width)
   - Ensure `CalendarPanel` works in tab (full width)

4. Add touch-optimized spacing:
   ```tsx
   // Increase tap targets for mobile (minimum 44px)
   className="px-4 py-3 md:px-2 md:py-1"  // Larger padding on mobile
   ```

**Testing Progression:**

1. **Chrome DevTools** (5 min)
   - Open `localhost:3000` → F12 → Device Toolbar
   - Test: iPhone SE (375px), iPhone 14 Pro (393px), iPhone 14 Pro Max (430px)
   - ✅ All tabs visible and tappable
   - ✅ Content fits without horizontal scroll
   - ✅ No text cutoff or overlap

2. **Safari Responsive Mode** (5 min)
   - Safari → Develop → Enter Responsive Design Mode
   - Test same devices
   - ✅ WebKit rendering looks correct
   - ✅ Fonts and spacing match Chrome

3. **iOS Simulator** (15 min)
   ```bash
   pnpm dev:web        # Terminal 1
   pnpm dev:mobile     # Terminal 2 (launches simulator)
   ```
   - Test on iPhone 15 Pro simulator
   - ✅ Tabs switch smoothly
   - ✅ Scrolling feels native
   - ✅ No visual glitches

**Acceptance Criteria:**
- [ ] Three tabs render correctly on mobile
- [ ] Desktop three-column layout unchanged
- [ ] Breakpoint at 768px (Tailwind `md:`)
- [ ] All interactive elements ≥ 44px tap target
- [ ] No horizontal scrolling on any screen size
- [ ] Content readable without zooming

**Files to Modify:**
- `apps/web/components/ThreeColumnLayout.tsx`
- Potentially: `ProjectsPanel.tsx`, `TaskHub.tsx`, `CalendarPanel.tsx` (mobile optimizations)

---

### 2. Add Native Haptic Feedback

**Priority:** 🟡 **HIGH** - Greatly improves native feel

**Why This Matters:**
Apple reviewers notice apps that "feel native". Haptic feedback is one of the easiest ways to achieve this.

**What to Build:**

Add haptic feedback to key interactions:

```tsx
// TaskItem.tsx - Add haptic on task completion
import { Native } from '@perfect-task-app/data'

const handleToggleComplete = async () => {
  // Haptic feedback BEFORE visual change (feels more responsive)
  if (Native.isNative()) {
    await Native.haptics('medium')
  }

  updateTaskMutation.mutate({
    id: task.id,
    is_completed: !task.is_completed
  })
}
```

**Where to Add Haptics:**

1. **Task Completion** - `TaskItem.tsx` ✅ Most important
   - Haptic: `medium`
   - Trigger: When checkbox toggled

2. **Task Creation** - `TaskQuickAdd.tsx`
   - Haptic: `light`
   - Trigger: When task successfully created

3. **Task Deletion** - `DeleteTaskDialog.tsx`
   - Haptic: `heavy`
   - Trigger: When delete confirmed (before mutation)

4. **Drag & Drop Success** - `CalendarPanel.tsx`
   - Haptic: `light`
   - Trigger: When task dropped on calendar block

5. **View Selection** - `SavedViews.tsx`
   - Haptic: `light`
   - Trigger: When switching views

**Implementation Pattern:**

```tsx
// Pattern for all haptic implementations
import { Native } from '@perfect-task-app/data'

const handleAction = async () => {
  // 1. Haptic feedback (instant response)
  if (Native.isNative()) {
    await Native.haptics('medium')  // or 'light' / 'heavy'
  }

  // 2. Then perform action
  performAction()
}
```

**Testing:**

1. **Browser** (won't work, that's OK)
   - Verify no errors in console
   - Verify `Native.isNative()` returns false

2. **iOS Simulator** (limited haptics)
   - Simulator doesn't vibrate, but code runs
   - Check console for errors

3. **Real iPhone** (REQUIRED for full testing)
   - Deploy TestFlight build
   - ✅ Feel haptic on task completion
   - ✅ Feel haptic on task creation
   - ✅ Feel haptic on deletion
   - ✅ Haptics feel appropriate (not too strong/weak)

**Acceptance Criteria:**
- [ ] Task completion triggers medium haptic
- [ ] Task creation triggers light haptic
- [ ] Task deletion triggers heavy haptic
- [ ] Drag & drop triggers light haptic
- [ ] View switching triggers light haptic
- [ ] No haptics on web (graceful degradation)
- [ ] No errors in console
- [ ] Tested on real iPhone device

**Files to Modify:**
- `apps/web/components/TaskItem.tsx`
- `apps/web/components/TaskQuickAdd.tsx`
- `apps/web/components/DeleteTaskDialog.tsx`
- `apps/web/components/CalendarPanel.tsx`
- `apps/web/components/SavedViews.tsx` (or wherever view switching happens)

---

### 3. Optimize Touch Interactions & Gestures

**Priority:** 🟡 **HIGH** - Critical for mobile UX

**Current Issues:**
- Desktop hover states don't work on mobile
- Small tap targets (< 44px minimum)
- No swipe gestures for common actions
- Drag & drop may feel laggy on touch

**What to Build:**

**A. Replace Hover with Touch-Friendly States**

```tsx
// TaskItem.tsx - Before (desktop-only)
<div className="hover:bg-gray-100 cursor-pointer">

// After (mobile + desktop)
<div className="active:bg-gray-200 md:hover:bg-gray-100 cursor-pointer touch-manipulation">
  {/* touch-manipulation = disables double-tap zoom */}
```

**B. Increase Tap Targets**

```tsx
// Minimum 44x44px for all interactive elements
<button className="min-h-[44px] min-w-[44px] p-3">
  <Icon className="w-5 h-5" />  {/* Icon smaller, padding larger */}
</button>
```

**C. Add Pull-to-Refresh (Optional but Nice)**

```tsx
// TaskHub.tsx - Add pull-to-refresh
import { useEffect, useState } from 'react'

export function TaskHub() {
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    let startY = 0

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY
    }

    const handleTouchMove = (e: TouchEvent) => {
      const currentY = e.touches[0].clientY
      const diff = currentY - startY

      // If scrolled to top and pulling down
      if (window.scrollY === 0 && diff > 80) {
        setIsRefreshing(true)
        refetchTasks().finally(() => setIsRefreshing(false))
      }
    }

    window.addEventListener('touchstart', handleTouchStart)
    window.addEventListener('touchmove', handleTouchMove)

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [refetchTasks])

  return (
    <div>
      {isRefreshing && <div className="text-center p-2">Refreshing...</div>}
      {/* ... rest of component ... */}
    </div>
  )
}
```

**D. Optimize Drag & Drop for Touch**

Your `@dnd-kit` library should work, but test thoroughly on touch:

```tsx
// Ensure touch-action is set correctly
<div className="touch-none" {...listeners}>  {/* Prevents scrolling during drag */}
  Draggable Item
</div>
```

**Global Touch Optimizations:**

Add to `apps/web/app/globals.css`:

```css
/* Mobile touch optimizations */
@media (max-width: 768px) {
  /* Prevent accidental zooming */
  * {
    touch-action: manipulation;
  }

  /* Smooth momentum scrolling */
  * {
    -webkit-overflow-scrolling: touch;
  }

  /* Remove tap highlight (use custom active states instead) */
  * {
    -webkit-tap-highlight-color: transparent;
  }
}
```

**Testing:**

1. **iOS Simulator**
   - ✅ All buttons tappable (not too small)
   - ✅ No double-tap zoom on buttons
   - ✅ Scrolling feels smooth
   - ✅ Drag & drop works with finger

2. **Real iPhone**
   - ✅ Tap targets easy to hit (not fat-fingering wrong items)
   - ✅ Active states visible (not just hover)
   - ✅ No accidental zooming
   - ✅ Pull-to-refresh works (if implemented)

**Acceptance Criteria:**
- [ ] All interactive elements ≥ 44px minimum
- [ ] Hover states replaced with active states for mobile
- [ ] `touch-manipulation` CSS applied globally
- [ ] No double-tap zoom on interactive elements
- [ ] Drag & drop works smoothly on touch
- [ ] Pull-to-refresh implemented (optional)
- [ ] Momentum scrolling feels native

**Files to Modify:**
- `apps/web/app/globals.css` (global touch styles)
- `apps/web/components/TaskItem.tsx`
- `apps/web/components/TaskQuickAdd.tsx`
- All button/interactive components
- `apps/web/components/CalendarPanel.tsx` (drag & drop)

---

### 4. Handle iOS Safe Areas & Notch

**Priority:** 🟡 **HIGH** - Prevents content from being cut off

**The Problem:**

Modern iPhones have:
- Notch / Dynamic Island at top
- Home indicator bar at bottom
- Rounded corners

Content can get cut off or overlap these areas.

**What to Build:**

**A. Add Safe Area Support**

```tsx
// apps/web/app/layout.tsx - Add viewport-fit
export const metadata = {
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,  // Prevent zooming
    viewportFit: 'cover',  // ← Critical for safe areas
  },
}
```

**B. Update Global Styles**

```css
/* apps/web/app/globals.css */

/* Safe area CSS variables */
:root {
  --safe-area-inset-top: env(safe-area-inset-top);
  --safe-area-inset-bottom: env(safe-area-inset-bottom);
  --safe-area-inset-left: env(safe-area-inset-left);
  --safe-area-inset-right: env(safe-area-inset-right);
}

/* Apply safe areas to main layout */
.mobile-safe-container {
  padding-top: max(1rem, env(safe-area-inset-top));
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* Bottom navigation/tabs need extra padding */
.mobile-bottom-nav {
  padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
}
```

**C. Apply to Your Mobile Layout**

```tsx
// ThreeColumnLayout.tsx - Mobile version
<div className="md:hidden flex flex-col h-screen">
  <Tabs value={activeTab} className="flex-1 flex flex-col">
    {/* Tabs at bottom with safe area */}
    <TabsContent value="tasks" className="flex-1 overflow-auto mobile-safe-container">
      <TaskHub {...props} />
    </TabsContent>

    <TabsList className="mobile-bottom-nav w-full grid grid-cols-3 rounded-none border-t">
      <TabsTrigger value="projects">Projects</TabsTrigger>
      <TabsTrigger value="tasks">Tasks</TabsTrigger>
      <TabsTrigger value="calendar">Calendar</TabsTrigger>
    </TabsList>
  </Tabs>
</div>
```

**Testing:**

1. **iOS Simulator** (iPhone 15 Pro - has Dynamic Island)
   - ✅ Content doesn't overlap top notch
   - ✅ Bottom tabs don't overlap home indicator
   - ✅ Content visible in rounded corners

2. **Real iPhone** (Newer model with notch/island)
   - ✅ All text readable
   - ✅ Tabs tappable above home indicator
   - ✅ No cutoff content

**Acceptance Criteria:**
- [ ] `viewport-fit=cover` set in metadata
- [ ] Safe area CSS variables defined
- [ ] Top content respects notch/Dynamic Island
- [ ] Bottom tabs respect home indicator
- [ ] Tested on iPhone with notch (11+)
- [ ] Tested on iPhone with Dynamic Island (14 Pro+)

**Files to Modify:**
- `apps/web/app/layout.tsx` (viewport metadata)
- `apps/web/app/globals.css` (safe area styles)
- `apps/web/components/ThreeColumnLayout.tsx` (apply safe areas)

---

### 5. Implement Native Share Functionality

**Priority:** 🟢 **MEDIUM** - Nice UX improvement, shows native integration

**What to Build:**

Add share functionality for tasks and projects using native share sheet:

```tsx
// TaskItem.tsx - Add share button
import { Native } from '@perfect-task-app/data'
import { Share } from 'lucide-react'

const handleShare = async () => {
  try {
    await Native.share({
      title: task.name,
      text: `Check out this task: ${task.name}`,
      url: `https://yourapp.com/tasks/${task.id}`,  // Deep link (future)
    })

    // Optional: Haptic feedback
    if (Native.isNative()) {
      await Native.haptics('light')
    }
  } catch (error) {
    console.error('Share failed:', error)
  }
}

return (
  <button onClick={handleShare} className="p-2">
    <Share className="w-5 h-5" />
  </button>
)
```

**Where to Add Share:**

1. **Task Item Actions** - Share individual task
2. **Project Actions** - Share project with team
3. **View Actions** - Share saved view configuration

**What Happens:**

- **iOS Native**: Shows native iOS share sheet (Messages, Mail, AirDrop, etc.)
- **Web**: Uses Web Share API (if supported) or fallback to clipboard
- **Graceful degradation**: Always works, just different UX

**Testing:**

1. **Browser**
   - ✅ Share button visible
   - ✅ Clipboard fallback works

2. **iOS Simulator**
   - ✅ Native share sheet appears
   - ✅ Can share to Messages (simulator)

3. **Real iPhone**
   - ✅ Full share sheet (all apps)
   - ✅ AirDrop works
   - ✅ Can actually share to Messages/Mail

**Acceptance Criteria:**
- [ ] Share button on task items
- [ ] Share button on projects
- [ ] Native share sheet on iOS
- [ ] Clipboard fallback on web
- [ ] Descriptive share text/title
- [ ] Deep links ready (URL structure)
- [ ] Tested on real iPhone

**Files to Modify:**
- `apps/web/components/TaskItem.tsx`
- `packages/ui/components/custom/ProjectsPanel.tsx`
- Potentially: `SavedViews.tsx`

---

### 6. Add App Icons, Splash Screen & Metadata

**Priority:** 🔴 **CRITICAL** - Required for App Store submission

**What to Build:**

**A. App Icon** (1024x1024px minimum)

1. Design app icon:
   - 1024x1024px PNG (no transparency)
   - Simple, recognizable design
   - Follows iOS Human Interface Guidelines

2. Generate all sizes:
   ```bash
   # Use online tool: https://www.appicon.co/
   # Or use Capacitor CLI (recommended):
   cd apps/mobile
   npx capacitor-assets generate --ios
   ```

3. Place in: `apps/mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/`

**B. Splash Screen**

```json
// apps/mobile/capacitor.config.ts
{
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#3b82f6",  // Your brand color
      showSpinner: false,
      iosSpinnerStyle: "small",
      splashFullScreen: true,
      splashImmersive: true,
    }
  }
}
```

Create splash image:
- 2732x2732px PNG
- Center your logo (safe area: 1200x1200px center)
- Use brand colors

**C. App Metadata**

```typescript
// apps/mobile/capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.perfecttask.app',  // Reverse domain
  appName: 'Perfect Task',       // Name in App Store
  webDir: '../web/out',

  ios: {
    contentInset: 'automatic',
    scheme: 'App',
  },
}

export default config;
```

**D. iOS Info.plist Permissions**

Update `apps/mobile/ios/App/App/Info.plist`:

```xml
<!-- Required permissions for your app -->
<key>NSCameraUsageDescription</key>
<string>Perfect Task needs camera access to add photos to tasks</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Perfect Task needs photo library access to attach images to tasks</string>

<key>NSCalendarsUsageDescription</key>
<string>Perfect Task integrates with your calendar to schedule tasks</string>

<!-- Remove any unused permissions to avoid rejection -->
```

**Testing:**

1. **iOS Simulator**
   - ✅ App icon appears on home screen
   - ✅ Splash screen shows on launch
   - ✅ App name correct
   - ✅ Permission dialogs appear (if triggered)

2. **Real iPhone**
   - ✅ Icon looks crisp (all sizes)
   - ✅ Splash screen smooth transition
   - ✅ Permissions work correctly

**Acceptance Criteria:**
- [ ] App icon created (1024x1024px)
- [ ] All icon sizes generated
- [ ] Splash screen created (2732x2732px)
- [ ] Splash screen configured in capacitor.config.ts
- [ ] App name set correctly
- [ ] App ID follows reverse domain (com.yourcompany.app)
- [ ] Info.plist permissions added (only what you use)
- [ ] Tested on device

**Files to Create/Modify:**
- `apps/mobile/resources/icon.png` (source icon)
- `apps/mobile/resources/splash.png` (source splash)
- `apps/mobile/capacitor.config.ts`
- `apps/mobile/ios/App/App/Info.plist`

---

### 7. Optimize Performance for Mobile

**Priority:** 🟡 **HIGH** - Prevents rejection for poor performance

**What to Optimize:**

**A. Enable Next.js Static Export for Production**

```javascript
// apps/web/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_OUTPUT === 'export' ? 'export' : undefined,

  // Optimize images for mobile
  images: {
    unoptimized: process.env.NEXT_OUTPUT === 'export',
  },

  // Disable server features for static export
  experimental: {
    optimizeCss: true,  // Optimize CSS for production
  },
}

module.exports = nextConfig
```

**B. Build Optimized Mobile Bundle**

```bash
# Build for Capacitor (static export)
cd apps/web
NEXT_OUTPUT=export pnpm build

# Sync to mobile app
cd ../mobile
pnpm run sync
```

**C. Lazy Load Heavy Components**

```tsx
// TaskHub.tsx - Lazy load calendar
import { lazy, Suspense } from 'react'

const CalendarPanel = lazy(() => import('./CalendarPanel'))

export function TaskHub() {
  return (
    <Suspense fallback={<div>Loading calendar...</div>}>
      <CalendarPanel userId={userId} />
    </Suspense>
  )
}
```

**D. Optimize TanStack Query Cache**

```tsx
// apps/web/app/providers.tsx
export function QueryProvider({ children }: Props) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,        // 1 min (reduce refetches)
        gcTime: 5 * 60 * 1000,       // 5 min (was cacheTime)
        refetchOnWindowFocus: false,  // Don't refetch on app resume (mobile)
        refetchOnMount: false,        // Only fetch if stale
        retry: 1,                     // Reduce retries (mobile networks)
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

**E. Add Loading States**

```tsx
// All data-fetching components should show loading states
const { data: tasks, isLoading } = useProjectTasks(projectId)

if (isLoading) {
  return <TaskListSkeleton />  // Don't show blank screen
}
```

**Testing:**

1. **Lighthouse (Chrome DevTools)**
   - Target: Performance score > 90
   - ✅ First Contentful Paint < 1.8s
   - ✅ Time to Interactive < 3.8s
   - ✅ Total Blocking Time < 200ms

2. **iOS Simulator** (Network throttling)
   - Xcode → Debug → Simulate Location → Custom (3G)
   - ✅ App loads in < 5 seconds
   - ✅ Loading states visible
   - ✅ No blank screens

3. **Real iPhone** (Real network)
   - Test on LTE/5G
   - ✅ Feels fast on real network
   - ✅ Transitions smooth
   - ✅ No jank when scrolling

**Acceptance Criteria:**
- [ ] Static export enabled for production builds
- [ ] Heavy components lazy loaded
- [ ] TanStack Query optimized for mobile
- [ ] All screens have loading states
- [ ] Lighthouse performance > 90
- [ ] Loads in < 5 seconds on 3G
- [ ] Smooth 60fps scrolling
- [ ] No memory leaks (test extended use)

**Files to Modify:**
- `apps/web/next.config.js`
- `apps/web/app/providers.tsx`
- Any heavy components (lazy load)
- All data-fetching components (loading states)

---

### 8. Test & Debug on Real Device

**Priority:** 🔴 **CRITICAL** - Simulator misses many issues

**What to Test:**

**A. Deploy TestFlight Build**

```bash
# 1. Build production app
cd apps/web
NEXT_OUTPUT=export pnpm build

# 2. Sync to mobile
cd ../mobile
pnpm run sync

# 3. Open in Xcode
pnpm run open:ios

# 4. In Xcode:
# - Product → Archive
# - Distribute App → TestFlight
# - Upload
```

**B. Create Testing Checklist**

Test these on real iPhone:

**Authentication:**
- [ ] Login with Google works
- [ ] Session persists (close app, reopen)
- [ ] Logout works
- [ ] Handles offline → online transition

**Core Functionality:**
- [ ] Create task (quick add)
- [ ] Edit task (all fields)
- [ ] Complete task (with haptic)
- [ ] Delete task (with confirmation)
- [ ] Create project
- [ ] Switch between projects
- [ ] Filter/sort tasks

**Calendar Integration:**
- [ ] View calendar
- [ ] Drag task to calendar (touch)
- [ ] Create work block
- [ ] Delete work block
- [ ] Sync with Google Calendar

**Mobile UX:**
- [ ] Tabs switch smoothly
- [ ] All buttons tappable (not too small)
- [ ] No horizontal scrolling
- [ ] Text readable (no tiny fonts)
- [ ] Safe areas respected (notch, home indicator)
- [ ] Keyboard doesn't cover inputs

**Native Features:**
- [ ] Haptics work (task completion, creation, deletion)
- [ ] Share works (native sheet appears)
- [ ] Notifications work (if implemented)
- [ ] App icon appears correctly
- [ ] Splash screen shows

**Performance:**
- [ ] Launches in < 3 seconds
- [ ] Scrolling smooth (no lag)
- [ ] No crashes after 10 minutes use
- [ ] No memory warnings
- [ ] Works on slow network (3G/LTE)

**Edge Cases:**
- [ ] Works in airplane mode (offline)
- [ ] Syncs when back online
- [ ] Handles low battery mode
- [ ] Handles phone calls (interruptions)
- [ ] Handles background → foreground

**C. Common Issues to Check**

1. **White Screen on Launch**
   - Check: `capacitor.config.ts` webDir path
   - Fix: Ensure `pnpm build` ran successfully

2. **Network Requests Fail**
   - Check: Supabase URL in production build
   - Fix: Environment variables for production

3. **Keyboard Covers Input**
   - Check: Viewport units (vh)
   - Fix: Use visual viewport or padding when keyboard shown

4. **Slow Loading**
   - Check: Bundle size
   - Fix: Lazy load components, optimize images

**Testing Tools:**

```bash
# Monitor iOS logs while testing
# In Terminal while device connected:
xcrun simctl spawn booted log stream --predicate 'process == "App"' --level debug
```

**Acceptance Criteria:**
- [ ] TestFlight build deployed
- [ ] Tested on at least 2 different iPhone models
- [ ] All checklist items passing
- [ ] No crashes in 30 minutes of use
- [ ] All native features work
- [ ] Performance acceptable
- [ ] Edge cases handled

---

### 9. Prepare App Store Listing

**Priority:** 🟡 **HIGH** - Required before submission

**What to Prepare:**

**A. App Store Connect Setup**

1. Create app in App Store Connect:
   - https://appstoreconnect.apple.com/
   - Apps → + → New App
   - Platform: iOS
   - Name: Perfect Task
   - Primary Language: English
   - Bundle ID: com.perfecttask.app (match capacitor.config.ts)
   - SKU: perfecttask-ios-001

**B. Required Text Content**

**App Name** (30 characters max):
```
Perfect Task
```

**Subtitle** (30 characters max):
```
Task & Calendar Management
```

**Description** (4000 characters max):

```
Perfect Task is a powerful task management app that helps you organize your work and life.

KEY FEATURES:

📋 Task Management
• Quick task creation with smart defaults
• Custom properties for project-specific fields
• Powerful filtering and sorting
• Kanban board views

📅 Calendar Integration
• Google Calendar sync
• Drag & drop task scheduling
• Work time blocking
• Calendar event visualization

🎯 Project Organization
• Multiple project support
• Saved views for common workflows
• Real-time collaboration
• Project-specific custom fields

✨ Designed for Productivity
• Native iOS experience
• Fast and responsive
• Offline support
• Seamless sync across devices

Perfect Task combines the flexibility of custom task properties with the power of calendar integration, helping you plan and execute your work more effectively.

SUBSCRIPTION INFORMATION:
[Add your pricing model here]

PRIVACY & SUPPORT:
Your data is stored securely using industry-standard encryption. We never sell your data to third parties.

Privacy Policy: https://yourwebsite.com/privacy
Terms of Service: https://yourwebsite.com/terms
Support: support@yourwebsite.com
```

**Keywords** (100 characters max, comma-separated):
```
tasks,todo,calendar,productivity,gtd,project,kanban,schedule,organizer,planner
```

**Support URL**:
```
https://yourwebsite.com/support
```

**Privacy Policy URL** (REQUIRED):
```
https://yourwebsite.com/privacy
```

**C. Screenshots (REQUIRED)**

You need screenshots for:
- 6.7" Display (iPhone 15 Pro Max) - REQUIRED - minimum 3-10 screenshots
- 6.5" Display (iPhone 11 Pro Max) - Optional but recommended
- 5.5" Display (iPhone 8 Plus) - Optional

**Screenshot Requirements:**
- PNG or JPEG
- RGB color space
- No transparency
- No rounded corners (Apple adds them)

**What to Screenshot:**

1. **Main Task List** (Hero shot)
   - Show organized tasks
   - Multiple projects visible
   - Clean, professional look

2. **Calendar View**
   - Calendar with tasks scheduled
   - Show drag & drop if possible (screenshot during drag)

3. **Task Detail**
   - Task editing view
   - Custom properties visible

4. **Project Management**
   - Projects panel
   - Multiple projects

5. **Kanban Board** (if implemented)
   - Visual workflow

**How to Capture:**

```bash
# 1. Launch iOS Simulator (iPhone 15 Pro Max)
pnpm dev:mobile

# 2. In Simulator:
# - Cmd+S to save screenshot
# - Screenshots save to Desktop

# 3. Or use Xcode:
# - Xcode → Window → Devices and Simulators
# - Select device → Take Screenshot
```

**Pro Tip:** Add text overlays in design tool (Figma, Sketch, Canva):
- Highlight key features
- Add arrows pointing to important UI
- Include short descriptions
- Use your brand colors

**D. App Preview Video** (Optional but Recommended)

- 15-30 seconds
- Show app in use
- Highlight key features
- Export at 1080p or higher

**E. App Categories**

Primary: Productivity
Secondary: Business or Utilities

**F. Age Rating**

Complete questionnaire (likely 4+):
- No objectionable content
- No gambling
- No mature themes

**Acceptance Criteria:**
- [ ] App Store Connect app created
- [ ] All text content written and reviewed
- [ ] 3-10 screenshots captured (6.7" display)
- [ ] Screenshots professionally edited (optional but nice)
- [ ] Privacy policy published (REQUIRED)
- [ ] Support page published
- [ ] Age rating completed
- [ ] Categories selected

**Resources Needed:**
- Apple Developer Account ($99/year)
- Website for privacy policy & support
- Screenshots (can create in simulator)

---

### 10. Final Pre-Submission Checklist

**Priority:** 🔴 **CRITICAL** - Final checks before submission

**Review These Before Submitting:**

**Technical Requirements:**
- [ ] App builds without errors in Xcode (Release mode)
- [ ] App runs on real iPhone (not just simulator)
- [ ] No crashes in 30 minutes of testing
- [ ] All network requests work (production Supabase)
- [ ] Authentication works (Google OAuth production keys)
- [ ] Offline mode graceful (shows appropriate messages)

**UI/UX Requirements:**
- [ ] Mobile responsive layout working
- [ ] All tabs/screens accessible
- [ ] No horizontal scrolling
- [ ] Tap targets ≥ 44px
- [ ] Text readable without zooming
- [ ] Safe areas respected (notch, home indicator)
- [ ] Loading states on all async operations
- [ ] Error states show user-friendly messages

**Native Integration:**
- [ ] Haptic feedback implemented
- [ ] Native share works
- [ ] App icon correct (all sizes)
- [ ] Splash screen shows
- [ ] Permissions requested with clear explanations
- [ ] Keyboard doesn't cover inputs

**App Store Requirements:**
- [ ] App name ≤ 30 characters
- [ ] Subtitle ≤ 30 characters
- [ ] Keywords ≤ 100 characters
- [ ] Description written
- [ ] 3-10 screenshots uploaded
- [ ] Privacy policy URL provided
- [ ] Support URL provided
- [ ] Age rating completed
- [ ] Categories selected

**Legal/Compliance:**
- [ ] Privacy policy mentions data collection
- [ ] Privacy policy mentions third parties (Supabase, Google)
- [ ] Terms of service published
- [ ] Contact email for support
- [ ] App doesn't violate trademarks
- [ ] App doesn't contain placeholder content

**Performance:**
- [ ] Launches in < 3 seconds
- [ ] Scrolling smooth (60fps)
- [ ] No memory leaks (extended testing)
- [ ] Works on 3G/LTE (slow network)
- [ ] Bundle size reasonable (< 50MB)

**Common Rejection Reasons to Avoid:**
- [ ] ❌ Incomplete mobile layout (FIXED)
- [ ] ❌ Crashes on launch (TEST THOROUGHLY)
- [ ] ❌ Broken authentication (TEST OAUTH)
- [ ] ❌ Missing privacy policy (ADD URL)
- [ ] ❌ Placeholder content (REPLACE ALL)
- [ ] ❌ Misleading screenshots (BE HONEST)
- [ ] ❌ Duplicate of web app (ADD NATIVE FEATURES)

**Submission Process:**

1. **Archive Build in Xcode**
   ```
   Xcode → Product → Archive
   (Wait 5-10 minutes for build)
   ```

2. **Upload to App Store Connect**
   ```
   Window → Organizer → Archives
   → Select your archive
   → Distribute App
   → App Store Connect
   → Upload
   ```

3. **Complete App Store Connect Form**
   - Select build
   - Add screenshots
   - Add description
   - Set pricing (Free or Paid)
   - Submit for Review

4. **Wait for Review**
   - Typical wait: 24-48 hours
   - Apple will email you with:
     - ✅ Approved (ready for sale)
     - ⚠️ Metadata Rejected (fix listing)
     - ❌ Rejected (need code changes)

5. **If Rejected:**
   - Read rejection reason carefully
   - Fix issues
   - Respond in Resolution Center
   - Resubmit

**Acceptance Criteria:**
- [ ] All checklist items above passing
- [ ] Build uploaded to App Store Connect
- [ ] App information complete
- [ ] Submitted for review
- [ ] Monitoring email for Apple's response

---

## Timeline & Order of Execution

**Week 1-2: Core Mobile Layout**
1. Item #1: Mobile responsive layout (CRITICAL)
2. Item #4: Safe areas & notch (CRITICAL)
3. Item #3: Touch interactions (HIGH)

**Week 3: Native Features**
4. Item #2: Haptic feedback (HIGH)
5. Item #5: Native share (MEDIUM)

**Week 4: Polish & Assets**
6. Item #6: App icons & splash screen (CRITICAL)
7. Item #7: Performance optimization (HIGH)

**Week 5: Testing**
8. Item #8: Real device testing (CRITICAL)

**Week 6: Submission**
9. Item #9: App Store listing (CRITICAL)
10. Item #10: Final pre-submission checks (CRITICAL)

---

## Success Metrics

**Before submitting, you should achieve:**
- ✅ Works on iPhone SE (smallest screen: 375px)
- ✅ Works on iPhone 15 Pro Max (largest screen: 430px)
- ✅ Lighthouse performance score > 90
- ✅ No crashes in 30-minute test
- ✅ All core features work on mobile
- ✅ At least 3 native integrations (haptics, share, notifications)
- ✅ TestFlight tested by 2+ people

**After submission:**
- 🎯 Target: Approval within 48 hours
- 🎯 Target: Zero rejections (with this checklist)
- 🎯 Target: 4+ star rating from early users

---

## Resources

**Documentation:**
- Capacitor Docs: https://capacitorjs.com/docs
- iOS Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/
- App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/

**Tools:**
- App Icon Generator: https://www.appicon.co/
- Screenshot Design: https://www.figma.com/templates/app-store-screenshots/
- TestFlight: https://developer.apple.com/testflight/

**Support:**
- Apple Developer Forums: https://developer.apple.com/forums/
- Capacitor Community: https://github.com/ionic-team/capacitor/discussions

---

## Notes

**Last Updated:** 2025-01-20
**Maintainer:** [Your Name]
**Status:** Ready to execute

**Updates Log:**
- 2025-01-20: Initial checklist created based on current app state
