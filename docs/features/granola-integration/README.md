# Granola Integration

Automatically extract and create tasks from Granola meeting notes using AI-powered parsing.

## Overview

This integration connects Flow with Granola via Zapier, allowing meeting notes to be automatically analyzed by AI to extract actionable tasks and add them to your task list.

## Architecture

```
Granola Meeting → Zapier Webhook → Flow API → OpenAI → Database
```

### Components

1. **Webhook Endpoint**: `apps/web/app/api/webhooks/granola/route.ts`
2. **AI Service**: `apps/web/lib/ai/taskExtractor.ts`
3. **Task Creation**: Uses existing `createTask` service from `@flow-app/data`

## Setup Instructions

### 1. Environment Variables

Add the following to your `.env` file:

```bash
# OpenAI API Key (required for task extraction)
OPENAI_API_KEY=sk-proj-xxxxx

# Webhook Secret (for security)
GRANOLA_WEBHOOK_SECRET=your_secure_random_string_here
```

**Generate a secure webhook secret:**
```bash
openssl rand -base64 32
```

### 2. Configure Zapier

#### Step 1: Create a New Zap

1. Go to Zapier and create a new Zap
2. **Trigger**: Select "Granola" → "Note Shared to Zapier"
3. Connect your Granola account

#### Step 2: Add Webhook Action

1. Add an action step: "Webhooks by Zapier"
2. Choose "POST" as the method
3. Configure the webhook:

**URL:**
```
https://your-domain.com/api/webhooks/granola
```

For local development:
```
https://your-ngrok-url.ngrok.io/api/webhooks/granola
```

**Headers:**
```json
{
  "Content-Type": "application/json",
  "x-webhook-secret": "your_webhook_secret_from_env"
}
```

**Data (JSON):**
```json
{
  "userId": "YOUR_PERFECT_TASK_USER_ID",
  "meetingTitle": "{{title}}",
  "enhancedNotes": "{{enhanced_notes}}",
  "transcript": "{{transcript}}",
  "attendees": "{{attendees}}",
  "timestamp": "{{created_at}}",
  "granolaLink": "{{link}}"
}
```

**Important**: Replace `YOUR_PERFECT_TASK_USER_ID` with your actual user ID from Flow. You can find this by:
```sql
SELECT id FROM profiles WHERE email = 'your@email.com';
```

#### Step 3: Test the Integration

1. In Granola, create a test meeting with some action items
2. Share the note to Zapier
3. Check your Flow app - tasks should appear in your General project

### 3. Get Your User ID

To find your Flow user ID:

**Option 1: Database Query**
```bash
psql "postgresql://postgres:PASSWORD@db.sprjddkfkwrrebazjxvf.supabase.co:5432/postgres" \
  -c "SELECT id, email FROM profiles WHERE email = 'your@email.com';"
```

**Option 2: Browser Console**
1. Log into Flow
2. Open browser DevTools → Console
3. Run:
```javascript
const { data: { user } } = await supabase.auth.getUser();
console.log(user.id);
```

## How It Works

### 1. Webhook Reception

The webhook endpoint receives meeting data from Zapier:

```typescript
{
  userId: string;           // Your Flow user ID
  meetingTitle: string;     // "Weekly Team Sync"
  enhancedNotes: string;    // Main meeting notes with to-dos
  transcript: string;       // Full meeting transcript (optional)
  attendees: string[];      // Meeting participants
  timestamp: string;        // Meeting time
  granolaLink: string;      // Link back to Granola
}
```

### 2. AI Task Extraction

The AI service (`taskExtractor.ts`) uses OpenAI GPT-4o-mini to:

- Identify actionable items from notes and transcript
- Extract task names (concise, verb-starting)
- Generate helpful descriptions with context
- Parse due dates (both explicit and relative like "by end of week")

**AI Model**: GPT-4o-mini (cost-efficient, can upgrade to GPT-4o for better accuracy)

### 3. Task Creation

Extracted tasks are created in your **General project** using the standard task creation flow:

- Validates data with Zod schemas
- Enforces Row-Level Security
- Updates TanStack Query cache
- Triggers UI re-render

### 4. Fallback Behavior

If AI extraction fails, the system creates a single task:

```typescript
{
  name: "Review meeting: [Meeting Title]",
  description: "[First 500 chars of notes]...",
  dueDate: null
}
```

This ensures you never lose meeting information.

## API Reference

### POST /api/webhooks/granola

Create tasks from Granola meeting notes.

**Headers:**
- `x-webhook-secret`: Your webhook secret (required)
- `Content-Type`: application/json

**Request Body:**
```typescript
{
  userId: string;           // Required
  meetingTitle: string;     // Required
  enhancedNotes: string;    // Required
  transcript?: string;      // Optional
  attendees?: string[];     // Optional
  timestamp?: string;       // Optional
  granolaLink?: string;     // Optional
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Successfully created 3 tasks from meeting: Weekly Team Sync",
  "tasks": [
    {
      "id": "uuid",
      "name": "Send Q4 report to stakeholders",
      "description": "Action item from meeting...",
      "due_date": "2025-11-15",
      "project_id": "uuid",
      "created_by": "uuid",
      "assigned_to": "uuid",
      "is_completed": false
    }
  ],
  "metadata": {
    "meetingTitle": "Weekly Team Sync",
    "granolaLink": "https://granola.so/...",
    "tasksCreated": 3
  }
}
```

**Error Responses:**

- `401`: Invalid webhook secret
- `400`: Missing required fields
- `404`: User's General project not found
- `500`: Server error (AI extraction failure, database error)

### GET /api/webhooks/granola

Health check endpoint.

**Response (200):**
```json
{
  "status": "active",
  "endpoint": "granola-webhook",
  "version": "1.0.0"
}
```

## Development & Testing

### Local Development

1. **Start development server:**
   ```bash
   pnpm dev:web
   ```

2. **Expose local server with ngrok:**
   ```bash
   ngrok http 3000
   ```

3. **Update Zapier webhook URL** to your ngrok URL:
   ```
   https://abc123.ngrok.io/api/webhooks/granola
   ```

### Testing the Endpoint

**Using curl:**
```bash
curl -X POST https://your-domain.com/api/webhooks/granola \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your_secret" \
  -d '{
    "userId": "your-user-id",
    "meetingTitle": "Test Meeting",
    "enhancedNotes": "TODO: Send report to team by Friday. TODO: Schedule follow-up meeting."
  }'
```

**Health check:**
```bash
curl https://your-domain.com/api/webhooks/granola
```

## Security

### Authentication

- Webhook secret validation prevents unauthorized access
- Secrets should be stored in environment variables, never committed to git
- Rotate secrets periodically

### Row-Level Security

- All task creation goes through standard RLS policies
- Users can only create tasks in projects they own/collaborate on
- Tasks are automatically assigned to the authenticated user

### Rate Limiting

**Recommended**: Add rate limiting middleware for production:

```typescript
// Example with Vercel Rate Limit
import { Ratelimit } from "@upstash/ratelimit";

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, "1 h"),
});
```

## Cost Considerations

### OpenAI API Usage

- **Model**: GPT-4o-mini
- **Estimated cost**: ~$0.002 per meeting extraction
- **Monthly estimate** (20 meetings): ~$0.04

To reduce costs further:
- Use smaller context windows (exclude transcript if notes are sufficient)
- Implement caching for similar meetings
- Set max_tokens limit

To improve quality:
- Upgrade to GPT-4o (higher cost, better accuracy)
- Increase temperature for more creative extraction
- Add few-shot examples in system prompt

## Troubleshooting

### Tasks Not Appearing

1. **Check webhook secret**: Ensure it matches `.env` file
2. **Verify user ID**: Confirm the userId in Zapier matches your Flow account
3. **Check General project**: Ensure your account has a General project
4. **View logs**: Check browser console or server logs for errors

### AI Extraction Quality Issues

1. **Review enhanced notes**: Ensure Granola is providing good quality notes
2. **Adjust AI prompt**: Modify system prompt in `taskExtractor.ts`
3. **Upgrade model**: Switch from gpt-4o-mini to gpt-4o
4. **Add examples**: Include few-shot examples in the prompt

### Webhook Timing Out

1. **Check OpenAI API**: Verify your API key is valid
2. **Reduce payload size**: Exclude transcript if very long
3. **Add timeout handling**: Implement async processing with job queue

## Future Enhancements

Potential improvements to consider:

- [ ] Project selection (allow specifying project in Zapier)
- [ ] Attendee assignment (auto-assign tasks to meeting participants)
- [ ] Duplicate detection (prevent creating same task from multiple shares)
- [ ] Custom AI prompts per user (allow users to customize extraction logic)
- [ ] Batch processing (handle multiple meetings in one request)
- [ ] Webhook signature verification (use Zapier's webhook signature)
- [ ] Real-time notifications (notify user when tasks are created)

## Support

For issues or questions:
1. Check application logs in browser console
2. Review Zapier execution history for webhook delivery status
3. Test the endpoint directly with curl to isolate issues
4. Verify OpenAI API quota and limits

---

**Last Updated**: 2025-11-08
**Maintained By**: Flow Team
