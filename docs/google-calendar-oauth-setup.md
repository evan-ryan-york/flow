# Google Calendar OAuth Setup Guide

This guide walks through setting up Google Cloud OAuth credentials for multi-account Google Calendar integration.

## Prerequisites
- Google Account (any Gmail account will work)
- Access to Google Cloud Console

## Step 1: Create or Select a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click the project dropdown at the top of the page
3. Either:
   - **Use existing project**: Select "perfect-task-app" or your existing project
   - **Create new project**:
     - Click "New Project"
     - Name it "Perfect Task App" or similar
     - Click "Create"

## Step 2: Enable Google Calendar API

1. In the Google Cloud Console, navigate to **APIs & Services > Library**
   - Or use direct link: https://console.cloud.google.com/apis/library
2. Search for "Google Calendar API"
3. Click on "Google Calendar API"
4. Click **Enable** button
5. Wait for confirmation that the API is enabled

## Step 3: Configure OAuth Consent Screen

1. Navigate to **APIs & Services > OAuth consent screen**
   - Or use direct link: https://console.cloud.google.com/apis/credentials/consent
2. Select **External** user type (unless you have a Google Workspace account, then Internal is fine)
3. Click **Create**
4. Fill in the App Information:
   - **App name**: Perfect Task App
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
5. Click **Save and Continue**
6. On the "Scopes" page, click **Add or Remove Scopes**
7. Search for and add these scopes:
   - `https://www.googleapis.com/auth/calendar.readonly` (Read calendar events)
   - `https://www.googleapis.com/auth/calendar.events` (Create/edit calendar events - for two-way sync)
   - `https://www.googleapis.com/auth/userinfo.email` (Get user's email address)
8. Click **Update** then **Save and Continue**
9. On "Test users" page (only needed during development):
   - Click **Add Users**
   - Add your email addresses that you'll use for testing
   - Click **Save and Continue**
10. Review the summary and click **Back to Dashboard**

## Step 4: Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services > Credentials**
   - Or use direct link: https://console.cloud.google.com/apis/credentials
2. Click **Create Credentials** at the top
3. Select **OAuth client ID**
4. If prompted to configure the consent screen, you may need to complete Step 3 first
5. Configure the OAuth client:
   - **Application type**: Web application
   - **Name**: Perfect Task App - Web Client
6. Under **Authorized redirect URIs**, click **Add URI** and add these:

   **Production:**
   ```
   https://ewuhxqbfwbenkhnkzokp.supabase.co/functions/v1/google-calendar-oauth-callback
   ```

   **Local Development (if using Supabase locally):**
   ```
   http://localhost:54321/functions/v1/google-calendar-oauth-callback
   ```

   **Web App (if testing directly from your web app):**
   ```
   http://localhost:3000/auth/google/callback
   ```

7. Click **Create**
8. A dialog will appear with your credentials - **IMPORTANT**: Copy these values:
   - **Client ID**: Will look like `123456789-abcdefg.apps.googleusercontent.com`
   - **Client Secret**: Will look like `GOCSPX-abc123def456`

## Step 5: Store Credentials in Supabase

You need to add the OAuth credentials as Supabase secrets so your Edge Functions can access them.

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/ewuhxqbfwbenkhnkzokp
2. Navigate to **Project Settings** (gear icon in sidebar)
3. Click **Edge Functions** in the left menu
4. Scroll to **Secrets** section
5. Add these secrets:
   - **Name**: `GOOGLE_OAUTH_CLIENT_ID`
     **Value**: Paste your Client ID from Step 4
   - **Name**: `GOOGLE_OAUTH_CLIENT_SECRET`
     **Value**: Paste your Client Secret from Step 4
6. Click **Save** for each

### Option B: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Set the secrets
npx supabase secrets set GOOGLE_OAUTH_CLIENT_ID="YOUR_CLIENT_ID_HERE"
npx supabase secrets set GOOGLE_OAUTH_CLIENT_SECRET="YOUR_CLIENT_SECRET_HERE"

# Verify they were set
npx supabase secrets list
```

## Step 6: Add Environment Variables Locally

For local development, add these to your `.env` file in the project root:

```env
# Add these lines to .env
GOOGLE_OAUTH_CLIENT_ID="YOUR_CLIENT_ID_HERE"
GOOGLE_OAUTH_CLIENT_SECRET="YOUR_CLIENT_SECRET_HERE"
```

Also add to `apps/web/.env.local`:

```env
# Add these lines to apps/web/.env.local
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID="YOUR_CLIENT_ID_HERE"
```

**IMPORTANT**: Never commit the `.env` files to git. They should already be in `.gitignore`.

## Step 7: Verify Setup

Once you've completed the above steps, verify:

- ✅ Google Calendar API is enabled
- ✅ OAuth consent screen is configured
- ✅ OAuth 2.0 client ID is created
- ✅ Redirect URIs are added (including Supabase Edge Function URL)
- ✅ Client ID and Secret are stored as Supabase secrets
- ✅ Environment variables are set locally

## Publishing Your App (Future)

During development, your app will be in "Testing" mode with limited users. When ready to launch:

1. Go back to **OAuth consent screen**
2. Click **Publish App**
3. Submit for Google verification (required if using sensitive scopes like calendar access)
4. This process can take several days

For now, keep it in Testing mode and add test users as needed.

## Troubleshooting

### "Access blocked: This app's request is invalid"
- Check that your redirect URI exactly matches what's in Google Cloud Console
- Ensure there are no trailing slashes or typos

### "Error 400: redirect_uri_mismatch"
- The redirect URI in your OAuth request doesn't match the ones registered
- Check both the Supabase Edge Function URL and your local development URL

### "This app isn't verified"
- This is normal during development
- Click "Advanced" → "Go to Perfect Task App (unsafe)" to proceed
- Users will see this until you publish and get Google's verification

### "The OAuth client was not found"
- Check that GOOGLE_OAUTH_CLIENT_ID matches exactly what's in Google Cloud Console
- Verify secrets are set in Supabase

## Next Steps

After completing this setup:
1. Test the OAuth flow by implementing the Edge Functions (Phase 3)
2. Add your test accounts (personal, work, etc.) to the test users list
3. Begin integration testing with multiple accounts

## Reference Links

- [Google Cloud Console](https://console.cloud.google.com)
- [Google Calendar API Documentation](https://developers.google.com/calendar/api/guides/overview)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
