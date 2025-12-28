# Microsoft Calendar Integration

**Status:** PLANNED
**Platforms:** iOS, macOS Desktop, Web
**Depends On:** Existing Google Calendar integration patterns

## Overview

Add Microsoft 365 / Outlook calendar integration to Flow, enabling users to connect work and personal Microsoft accounts alongside existing Google Calendar connections. Users will see events from all providers in a unified calendar view.

## Goals

1. **Multi-provider support** - Users can connect both Google and Microsoft calendars
2. **Unified experience** - Same UI patterns for managing both providers
3. **Cross-platform OAuth** - Secure authentication on iOS, macOS Desktop, and Web
4. **Incremental sync** - Efficient delta sync using Microsoft Graph's `deltaLink`
5. **Code reuse** - Leverage existing infrastructure where possible

## Quick Navigation

### Implementation
- **[Implementation Plan](./implementation-plan.md)** - Complete build plan with phases
- **[Cross-Platform OAuth](./cross-platform-oauth.md)** - OAuth strategies for iOS/macOS/Web

### Architecture
- **[Database Migration](./database-migration.md)** - Schema changes for multi-provider support
- **[API Comparison](./api-comparison.md)** - Google vs Microsoft API differences

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      User's Device                               │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │CalendarPanel │──>│  useCalendar │──>│ calendarService      │ │
│  │  (Unified)   │   │   (Hooks)    │   │ (Provider-agnostic)  │ │
│  └──────────────┘   └──────────────┘   └──────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Supabase Backend                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         Database Tables (with RLS)                        │   │
│  │  • calendar_connections        (OAuth - both providers)   │   │
│  │  • calendar_subscriptions      (Calendar list)            │   │
│  │  • calendar_events             (Cached events)            │   │
│  │  • calendar_sync_state         (Sync tracking)            │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         Edge Functions (Deno)                             │   │
│  │  • microsoft-calendar-oauth        (Azure AD auth)        │   │
│  │  • microsoft-calendar-refresh-token                       │   │
│  │  • microsoft-calendar-sync-calendars                      │   │
│  │  • microsoft-calendar-sync-events                         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│   Google Calendar API    │   │   Microsoft Graph API    │
│   (OAuth 2.0 + Events)   │   │   (OAuth 2.0 + Events)   │
└──────────────────────────┘   └──────────────────────────┘
```

## Key Differences: Google vs Microsoft

| Aspect | Google Calendar | Microsoft Graph |
|--------|-----------------|-----------------|
| OAuth Provider | Google Identity | Azure AD / Microsoft Identity |
| API Endpoint | `googleapis.com/calendar/v3` | `graph.microsoft.com/v1.0` |
| Incremental Sync | `syncToken` | `deltaLink` |
| Calendar List | `/users/me/calendarList` | `/me/calendars` |
| Events | `/calendars/{id}/events` | `/me/calendars/{id}/events` |
| Token Endpoint | `oauth2.googleapis.com/token` | `login.microsoftonline.com/.../token` |
| Scopes | `calendar.readonly`, `calendar.events` | `Calendars.Read`, `Calendars.ReadWrite` |

## Implementation Phases

1. **Phase 1: Azure AD Setup & Database Migration** - App registration, schema updates
2. **Phase 2: Edge Functions** - OAuth, token refresh, sync functions
3. **Phase 3: Service Layer Updates** - Provider-agnostic services
4. **Phase 4: Hook Layer Updates** - Unified React hooks
5. **Phase 5: UI Updates** - Provider selection, settings page
6. **Phase 6: Cross-Platform Testing** - iOS, macOS Desktop, Web verification
7. **Phase 7: Documentation & Polish** - User guides, troubleshooting

## Estimated Effort

| Phase | Complexity | Notes |
|-------|------------|-------|
| Phase 1 | Low | Azure portal config + SQL migration |
| Phase 2 | Medium | 4 new Edge Functions |
| Phase 3 | Low | Extend existing patterns |
| Phase 4 | Low | Minimal hook changes |
| Phase 5 | Low | Add provider selector |
| Phase 6 | Medium | Cross-platform OAuth testing |
| Phase 7 | Low | Documentation |

## Cross-Platform OAuth Strategy

### Web
- Standard OAuth 2.0 redirect flow
- Popup window for auth (same as Google)
- Redirect URI: `https://<supabase>.supabase.co/functions/v1/microsoft-calendar-oauth`

### iOS (Capacitor)
- Use `@capacitor/browser` for OAuth popup
- Custom URL scheme callback: `com.flowapp.app://oauth/microsoft/callback`
- Deep link handling to return tokens to app

### macOS Desktop (Tauri)
- Use system browser for OAuth
- Local server callback or custom protocol handler
- `tauri://localhost/oauth/microsoft/callback`

## Security Considerations

1. **Multi-tenant Azure AD app** - Support both personal and work accounts
2. **State token validation** - CSRF protection (reuse `oauth_state_tokens` table)
3. **Token encryption** - Consider encrypting tokens at rest
4. **RLS policies** - Extend existing policies to new provider
5. **Scope minimization** - Request only `Calendars.Read` initially

## Success Criteria

- [ ] Users can connect Microsoft 365 / Outlook accounts
- [ ] OAuth works on iOS, macOS Desktop, and Web
- [ ] Events sync every 5 minutes (same as Google)
- [ ] Unified calendar view shows both providers
- [ ] Calendar visibility toggles work per-provider
- [ ] Disconnect removes all provider data (cascade delete)
- [ ] Token refresh works automatically
- [ ] Re-auth prompts when tokens expire

## File Locations (Planned)

### Backend
- `supabase/migrations/YYYYMMDD_add_microsoft_calendar_integration.sql`
- `supabase/functions/microsoft-calendar-oauth/index.ts`
- `supabase/functions/microsoft-calendar-refresh-token/index.ts`
- `supabase/functions/microsoft-calendar-sync-calendars/index.ts`
- `supabase/functions/microsoft-calendar-sync-events/index.ts`

### Frontend
- `packages/models/index.ts` - Update connection schema with provider field
- `packages/data/services/calendarService.ts` - Provider-agnostic updates
- `packages/data/hooks/useCalendar.ts` - Provider parameter support
- `apps/web/app/app/settings/calendar-connections/page.tsx` - Provider selector

---

*See [implementation-plan.md](./implementation-plan.md) for detailed build instructions.*
