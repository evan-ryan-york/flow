# Vercel Environment Variables Setup

## Required Environment Variables

You need to add these environment variables to your Vercel project settings:

### 1. Go to Vercel Dashboard
- Navigate to: https://vercel.com/your-username/your-project-name/settings/environment-variables
- Or: Vercel Dashboard → Your Project → Settings → Environment Variables

### 2. Add These Variables

**NEXT_PUBLIC_SUPABASE_URL**
```
https://<your-supabase-project>.supabase.co
```
- Environment: Production, Preview, Development (check all)
- Get from: Supabase Dashboard → Settings → API → Project URL

**NEXT_PUBLIC_SUPABASE_ANON_KEY**
```
<your-supabase-anon-key>
```
- Environment: Production, Preview, Development (check all)
- Get from: Supabase Dashboard → Settings → API → anon public key

### 3. Redeploy

After adding the environment variables, you need to trigger a new deployment:
- Go to: Deployments tab
- Click the three dots (•••) on the latest deployment
- Click "Redeploy"
- OR: Push a new commit to trigger automatic deployment

## Why This is Needed

Next.js environment variables prefixed with `NEXT_PUBLIC_` are **embedded into the client bundle at BUILD time**. Vercel needs to have these variables configured in the project settings so they're available during the build process.

Without these variables:
- The build will succeed (we allow empty values during build)
- But the app will crash in the browser with "Missing environment variables" errors
- The Supabase client cannot be initialized without valid credentials

## Verification

After redeploying with the environment variables:
1. Open your Vercel deployment URL
2. Open browser console (F12)
3. You should NOT see any "Missing environment variables" errors
4. The login page should load successfully
5. Google OAuth should work

## Alternative: Use Vercel CLI

You can also set environment variables using the Vercel CLI:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Paste the value when prompted

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Paste the value when prompted

# Then redeploy
vercel --prod
```
