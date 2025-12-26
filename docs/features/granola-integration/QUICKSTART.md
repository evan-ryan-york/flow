# Granola Integration - Quick Start Guide

## What Was Built

A complete integration that automatically extracts tasks from Granola meeting notes using AI and adds them to your Flow app.

### Files Created

1. **Webhook Endpoint**: `apps/web/app/api/webhooks/granola/route.ts`
   - Receives meeting data from Zapier
   - Validates webhook security
   - Creates tasks in your General project

2. **AI Service**: `apps/web/lib/ai/taskExtractor.ts`
   - Uses OpenAI GPT-4o-mini to extract actionable tasks
   - Identifies task names, descriptions, and due dates
   - Handles fallback gracefully if AI fails

3. **Documentation**: `docs/features/granola-integration/README.md`
   - Complete setup instructions
   - API reference
   - Troubleshooting guide

## Next Steps

### 1. Set Up Your OpenAI API Key

```bash
# Get your API key from: https://platform.openai.com/api-keys
# Add to .env file (replace the placeholder):
OPENAI_API_KEY=sk-proj-your-actual-key-here
```

### 2. Generate a Webhook Secret

```bash
# Generate a secure random string:
openssl rand -base64 32

# Add to .env file (replace the placeholder):
GRANOLA_WEBHOOK_SECRET=your-generated-secret-here
```

### 3. Configure Zapier

Go to Zapier and set up your Zap:

**Trigger**: Granola → "Note Shared to Zapier"

**Action**: Webhooks by Zapier → POST

**Webhook URL** (for production):
```
https://your-domain.com/api/webhooks/granola
```

**Headers**:
```json
{
  "Content-Type": "application/json",
  "x-webhook-secret": "paste-your-webhook-secret-here"
}
```

**Body (JSON)**:
```json
{
  "userId": "YOUR_USER_ID_FROM_PERFECT_TASK",
  "meetingTitle": "{{title}}",
  "enhancedNotes": "{{enhanced_notes}}",
  "transcript": "{{transcript}}",
  "attendees": "{{attendees}}",
  "timestamp": "{{created_at}}",
  "granolaLink": "{{link}}"
}
```

### 4. Get Your User ID

Run this in your database:
```sql
SELECT id FROM profiles WHERE email = 'your@email.com';
```

Or use the Supabase dashboard to find your user ID in the profiles table.

### 5. Test It!

1. Create a meeting in Granola with some action items
2. Share the note to Zapier
3. Check your Flow app - tasks should appear in your General project

## Local Development Testing

If you want to test locally:

1. **Start the dev server**:
   ```bash
   pnpm dev:web
   ```

2. **Expose your localhost with ngrok**:
   ```bash
   ngrok http 3000
   ```

3. **Update Zapier webhook URL** to:
   ```
   https://your-ngrok-url.ngrok.io/api/webhooks/granola
   ```

4. **Test by sharing a note from Granola**

## Health Check

Test if your endpoint is working:

```bash
# Should return: {"status":"active","endpoint":"granola-webhook","version":"1.0.0"}
curl https://your-domain.com/api/webhooks/granola
```

## Cost Estimate

- **OpenAI GPT-4o-mini**: ~$0.002 per meeting
- **20 meetings/month**: ~$0.04/month

Very affordable for automatic task extraction!

## Need Help?

See the full documentation in `docs/features/granola-integration/README.md`

---

**Ready to go!** Just add your API keys and configure Zapier.
