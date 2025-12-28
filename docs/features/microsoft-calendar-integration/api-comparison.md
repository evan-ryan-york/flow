# Google Calendar API vs Microsoft Graph API Comparison

This document compares the two calendar APIs to help developers understand the differences when implementing the Microsoft Calendar integration.

## Overview

| Aspect | Google Calendar API | Microsoft Graph API |
|--------|--------------------|--------------------|
| API Version | v3 | v1.0 |
| Base URL | `https://www.googleapis.com/calendar/v3` | `https://graph.microsoft.com/v1.0` |
| Auth Provider | Google Identity | Azure AD / Microsoft Identity |
| Token Endpoint | `oauth2.googleapis.com/token` | `login.microsoftonline.com/{tenant}/oauth2/v2.0/token` |
| Documentation | [developers.google.com/calendar](https://developers.google.com/calendar/api/v3/reference) | [learn.microsoft.com/graph](https://learn.microsoft.com/en-us/graph/api/resources/calendar) |

---

## OAuth 2.0

### Authorization URL

**Google:**
```
https://accounts.google.com/o/oauth2/v2/auth?
  client_id={CLIENT_ID}&
  redirect_uri={REDIRECT_URI}&
  response_type=code&
  scope=https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events&
  access_type=offline&
  prompt=consent
```

**Microsoft:**
```
https://login.microsoftonline.com/common/oauth2/v2.0/authorize?
  client_id={CLIENT_ID}&
  redirect_uri={REDIRECT_URI}&
  response_type=code&
  scope=openid profile email offline_access Calendars.Read Calendars.ReadWrite&
  response_mode=query&
  prompt=consent
```

### Key Differences

| Aspect | Google | Microsoft |
|--------|--------|-----------|
| Tenant | N/A (single endpoint) | `common`, `organizations`, `consumers`, or specific tenant ID |
| Offline access | `access_type=offline` | `offline_access` scope |
| Force consent | `prompt=consent` | `prompt=consent` |
| Response mode | Query params (default) | `response_mode=query` (explicit) |

### Token Exchange

**Google:**
```bash
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

code={CODE}&
client_id={CLIENT_ID}&
client_secret={CLIENT_SECRET}&
redirect_uri={REDIRECT_URI}&
grant_type=authorization_code
```

**Microsoft:**
```bash
POST https://login.microsoftonline.com/common/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

code={CODE}&
client_id={CLIENT_ID}&
client_secret={CLIENT_SECRET}&
redirect_uri={REDIRECT_URI}&
grant_type=authorization_code
```

### Token Response

**Google:**
```json
{
  "access_token": "ya29.xxx",
  "expires_in": 3599,
  "refresh_token": "1//xxx",
  "scope": "https://www.googleapis.com/auth/calendar.readonly",
  "token_type": "Bearer"
}
```

**Microsoft:**
```json
{
  "access_token": "eyJ0xxx",
  "expires_in": 3600,
  "refresh_token": "0.AXYAxxx",
  "scope": "Calendars.Read Calendars.ReadWrite",
  "token_type": "Bearer",
  "id_token": "eyJ0xxx"
}
```

### Scopes Comparison

| Permission | Google Scope | Microsoft Scope |
|------------|-------------|-----------------|
| Read calendars | `calendar.readonly` | `Calendars.Read` |
| Read/write calendars | `calendar.events` | `Calendars.ReadWrite` |
| User email | `userinfo.email` | `email` (or `User.Read`) |
| Offline access | `access_type=offline` param | `offline_access` scope |

---

## Calendar List API

### Fetch User's Calendars

**Google:**
```bash
GET https://www.googleapis.com/calendar/v3/users/me/calendarList
Authorization: Bearer {ACCESS_TOKEN}
```

**Microsoft:**
```bash
GET https://graph.microsoft.com/v1.0/me/calendars
Authorization: Bearer {ACCESS_TOKEN}
```

### Response Format

**Google:**
```json
{
  "kind": "calendar#calendarList",
  "items": [
    {
      "id": "primary",
      "summary": "Personal Calendar",
      "description": "My personal calendar",
      "timeZone": "America/New_York",
      "colorId": "1",
      "backgroundColor": "#ac725e",
      "foregroundColor": "#1d1d1d",
      "accessRole": "owner",
      "primary": true
    }
  ]
}
```

**Microsoft:**
```json
{
  "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#me/calendars",
  "value": [
    {
      "id": "AAMkAGI2xxx",
      "name": "Calendar",
      "color": "auto",
      "hexColor": "#0078d4",
      "isDefaultCalendar": true,
      "canEdit": true,
      "canShare": true,
      "owner": {
        "name": "John Doe",
        "address": "john@example.com"
      }
    }
  ]
}
```

### Field Mapping

| Concept | Google Field | Microsoft Field |
|---------|-------------|-----------------|
| Calendar ID | `id` | `id` |
| Calendar name | `summary` | `name` |
| Description | `description` | N/A (not in list response) |
| Color | `backgroundColor` | `hexColor` or `color` |
| Is primary | `primary: true` | `isDefaultCalendar: true` |
| Can edit | `accessRole === 'owner'` | `canEdit` |

---

## Events API

### Fetch Events

**Google:**
```bash
GET https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events?
  timeMin={START_DATE}&
  timeMax={END_DATE}&
  singleEvents=true&
  orderBy=startTime
Authorization: Bearer {ACCESS_TOKEN}
```

**Microsoft:**
```bash
GET https://graph.microsoft.com/v1.0/me/calendars/{calendarId}/events?
  $filter=start/dateTime ge '{START_DATE}' and end/dateTime le '{END_DATE}'&
  $orderby=start/dateTime&
  $select=id,subject,bodyPreview,start,end,isAllDay,location
Authorization: Bearer {ACCESS_TOKEN}
```

### Event Response

**Google:**
```json
{
  "kind": "calendar#event",
  "id": "abc123",
  "status": "confirmed",
  "htmlLink": "https://calendar.google.com/event?eid=xxx",
  "summary": "Team Meeting",
  "description": "Weekly sync",
  "location": "Conference Room A",
  "start": {
    "dateTime": "2024-01-15T10:00:00-05:00",
    "timeZone": "America/New_York"
  },
  "end": {
    "dateTime": "2024-01-15T11:00:00-05:00",
    "timeZone": "America/New_York"
  },
  "colorId": "1"
}
```

**Microsoft:**
```json
{
  "@odata.type": "#microsoft.graph.event",
  "id": "AAMkAGI2xxx",
  "subject": "Team Meeting",
  "bodyPreview": "Weekly sync",
  "start": {
    "dateTime": "2024-01-15T10:00:00.0000000",
    "timeZone": "Eastern Standard Time"
  },
  "end": {
    "dateTime": "2024-01-15T11:00:00.0000000",
    "timeZone": "Eastern Standard Time"
  },
  "isAllDay": false,
  "location": {
    "displayName": "Conference Room A"
  },
  "categories": ["Blue category"]
}
```

### Field Mapping

| Concept | Google Field | Microsoft Field |
|---------|-------------|-----------------|
| Event ID | `id` | `id` |
| Title | `summary` | `subject` |
| Description | `description` | `bodyPreview` or `body.content` |
| Start time | `start.dateTime` | `start.dateTime` |
| End time | `end.dateTime` | `end.dateTime` |
| All-day event | `start.date` (no time) | `isAllDay: true` |
| Location | `location` | `location.displayName` |
| Color | `colorId` | `categories` (mapped to colors) |
| Status | `status` | `showAs` |
| Cancelled | `status === 'cancelled'` | `isCancelled: true` |

---

## Incremental Sync (Delta)

Both APIs support efficient incremental syncing to avoid re-fetching all events.

### Google: syncToken

**Initial sync:**
```bash
GET /calendar/v3/calendars/{calendarId}/events?
  timeMin={30_DAYS_AGO}&
  timeMax={90_DAYS_FUTURE}
```

Response includes `nextSyncToken`:
```json
{
  "items": [...],
  "nextSyncToken": "CPDAlvWDx78CEPDAlvWDx78CGAU="
}
```

**Incremental sync:**
```bash
GET /calendar/v3/calendars/{calendarId}/events?
  syncToken=CPDAlvWDx78CEPDAlvWDx78CGAU=
```

**Handling expired token:**
```json
{
  "error": {
    "code": 410,
    "message": "Sync token is no longer valid"
  }
}
```
→ Fall back to full sync

### Microsoft: deltaLink

**Initial sync:**
```bash
GET /me/calendars/{calendarId}/events/delta?
  $filter=start/dateTime ge '{30_DAYS_AGO}'
```

Response includes `@odata.deltaLink`:
```json
{
  "value": [...],
  "@odata.deltaLink": "https://graph.microsoft.com/v1.0/me/calendars/{id}/events/delta?$deltatoken=xxx"
}
```

**Incremental sync:**
```bash
GET {deltaLink}
```

**Handling expired token:**
```json
{
  "error": {
    "code": "ResyncRequired",
    "message": "The delta token has expired"
  }
}
```
HTTP Status: `410 Gone`
→ Fall back to full sync

### Comparison

| Aspect | Google | Microsoft |
|--------|--------|-----------|
| Token name | `syncToken` | `deltaLink` (full URL) |
| Token location | Response body | Response body |
| Request method | Query parameter | Full URL |
| Expired token | 410 error | 410 error |
| Deleted items | `status: 'cancelled'` | `@removed` property |

---

## All-Day Events

### Google
All-day events use `date` instead of `dateTime`:
```json
{
  "start": {
    "date": "2024-01-15"
  },
  "end": {
    "date": "2024-01-16"
  }
}
```

### Microsoft
All-day events set `isAllDay: true`:
```json
{
  "start": {
    "dateTime": "2024-01-15T00:00:00.0000000",
    "timeZone": "UTC"
  },
  "end": {
    "dateTime": "2024-01-16T00:00:00.0000000",
    "timeZone": "UTC"
  },
  "isAllDay": true
}
```

---

## Recurring Events

### Google
Returns individual instances with `singleEvents=true`:
```bash
GET /events?singleEvents=true
```

Or returns the recurrence pattern:
```json
{
  "recurrence": ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"]
}
```

### Microsoft
Returns individual instances with `/instances` endpoint:
```bash
GET /events/{id}/instances?
  startDateTime={START}&
  endDateTime={END}
```

Or pattern in event:
```json
{
  "recurrence": {
    "pattern": {
      "type": "weekly",
      "interval": 1,
      "daysOfWeek": ["monday", "wednesday", "friday"]
    },
    "range": {
      "type": "endDate",
      "startDate": "2024-01-01",
      "endDate": "2024-12-31"
    }
  }
}
```

---

## Time Zones

### Google
Uses IANA time zone names:
```json
{
  "timeZone": "America/New_York"
}
```

### Microsoft
Uses Windows time zone names:
```json
{
  "timeZone": "Eastern Standard Time"
}
```

**Conversion needed** - Use a library like `timezone-support` or hard-coded mapping.

Common mappings:
| IANA | Windows |
|------|---------|
| `America/New_York` | `Eastern Standard Time` |
| `America/Los_Angeles` | `Pacific Standard Time` |
| `Europe/London` | `GMT Standard Time` |
| `UTC` | `UTC` |

---

## Error Handling

### Google Errors
```json
{
  "error": {
    "code": 401,
    "message": "Invalid Credentials",
    "errors": [
      {
        "domain": "global",
        "reason": "authError",
        "message": "Invalid Credentials"
      }
    ]
  }
}
```

### Microsoft Errors
```json
{
  "error": {
    "code": "InvalidAuthenticationToken",
    "message": "Access token has expired or is not yet valid.",
    "innerError": {
      "date": "2024-01-15T10:00:00",
      "request-id": "xxx",
      "client-request-id": "xxx"
    }
  }
}
```

### Common Error Codes

| Scenario | Google | Microsoft |
|----------|--------|-----------|
| Invalid token | 401 | 401 `InvalidAuthenticationToken` |
| Token expired | 401 | 401 `InvalidAuthenticationToken` |
| Rate limited | 403 `rateLimitExceeded` | 429 `TooManyRequests` |
| Sync token expired | 410 | 410 `ResyncRequired` |
| Not found | 404 | 404 `ResourceNotFound` |
| Forbidden | 403 | 403 `Authorization_RequestDenied` |

---

## Rate Limits

### Google
- 1,000,000 requests per day (default)
- 100 requests per 100 seconds per user
- Exponential backoff recommended

### Microsoft
- Service-specific limits
- Per-app and per-user limits
- Retry-After header provided

### Handling Rate Limits

```typescript
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options)

    if (response.status === 429 || response.status === 503) {
      const retryAfter = response.headers.get('Retry-After')
      const delay = retryAfter
        ? parseInt(retryAfter) * 1000
        : Math.pow(2, attempt) * 1000 // Exponential backoff

      await new Promise(resolve => setTimeout(resolve, delay))
      continue
    }

    return response
  }

  throw new Error('Max retries exceeded')
}
```

---

## Batch Requests

### Google
```bash
POST https://www.googleapis.com/batch/calendar/v3
Content-Type: multipart/mixed; boundary=batch_boundary

--batch_boundary
Content-Type: application/http
Content-ID: <item1>

GET /calendar/v3/calendars/primary/events/event1

--batch_boundary
Content-Type: application/http
Content-ID: <item2>

GET /calendar/v3/calendars/primary/events/event2

--batch_boundary--
```

### Microsoft
```bash
POST https://graph.microsoft.com/v1.0/$batch
Content-Type: application/json

{
  "requests": [
    {
      "id": "1",
      "method": "GET",
      "url": "/me/calendars/calendar1/events/event1"
    },
    {
      "id": "2",
      "method": "GET",
      "url": "/me/calendars/calendar1/events/event2"
    }
  ]
}
```

---

## Implementation Notes

### Normalizing Event Data

```typescript
interface NormalizedEvent {
  id: string
  provider: 'google' | 'microsoft'
  providerId: string
  title: string
  description: string | null
  startTime: Date
  endTime: Date
  isAllDay: boolean
  location: string | null
  color: string | null
}

function normalizeGoogleEvent(event: GoogleEvent): NormalizedEvent {
  const isAllDay = !!event.start.date
  return {
    id: crypto.randomUUID(),
    provider: 'google',
    providerId: event.id,
    title: event.summary || '(No title)',
    description: event.description || null,
    startTime: new Date(event.start.dateTime || event.start.date),
    endTime: new Date(event.end.dateTime || event.end.date),
    isAllDay,
    location: event.location || null,
    color: getGoogleColor(event.colorId),
  }
}

function normalizeMicrosoftEvent(event: MicrosoftEvent): NormalizedEvent {
  return {
    id: crypto.randomUUID(),
    provider: 'microsoft',
    providerId: event.id,
    title: event.subject || '(No title)',
    description: event.bodyPreview || null,
    startTime: new Date(event.start.dateTime + 'Z'),
    endTime: new Date(event.end.dateTime + 'Z'),
    isAllDay: event.isAllDay,
    location: event.location?.displayName || null,
    color: getMicrosoftCategoryColor(event.categories),
  }
}
```

### Handling Deleted Events

```typescript
function processEventChanges(events: any[], provider: 'google' | 'microsoft') {
  const toUpsert: NormalizedEvent[] = []
  const toDelete: string[] = []

  for (const event of events) {
    if (provider === 'google' && event.status === 'cancelled') {
      toDelete.push(event.id)
    } else if (provider === 'microsoft' && event['@removed']) {
      toDelete.push(event.id)
    } else {
      const normalized = provider === 'google'
        ? normalizeGoogleEvent(event)
        : normalizeMicrosoftEvent(event)
      toUpsert.push(normalized)
    }
  }

  return { toUpsert, toDelete }
}
```
