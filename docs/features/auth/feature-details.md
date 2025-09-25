# Authentication System - Feature Details

**Status**: ✅ Implemented & Working
**Last Updated**: September 23, 2025
**Authentication Method**: Google OAuth only

## How Authentication Works

### Overview
The app uses Google OAuth for authentication with automatic profile creation and a simple onboarding flow for new users.

### User Flow

1. **Login Screen**: User clicks "Sign in with Google"
2. **OAuth Redirect**: Browser opens Google OAuth flow
3. **Authentication**: User selects Google account and grants permission
4. **Session Creation**: Supabase automatically creates/restores session
5. **Profile Check**: App checks if user has completed onboarding
6. **Conditional Flow**:
   - **New User**: Shows WelcomeModal to confirm name
   - **Returning User**: Goes directly to main app

### Technical Implementation

#### Key Components

**Login Screen** (`apps/mobile/app/(auth)/login.tsx`)
- Single "Sign in with Google" button
- Uses Supabase's `signInWithOAuth({ provider: 'google' })`
- Auth state listener handles OAuth callback automatically

**App Layout** (`apps/mobile/app/(app)/_layout.tsx`)
- Checks authentication status
- Determines if user needs onboarding (`!profile.first_name`)
- Shows WelcomeModal for new users
- Provides logout button

**Welcome Modal** (`apps/mobile/components/WelcomeModal.tsx`)
- Name confirmation for new users
- Pre-filled with Google display name
- Updates `first_name` field when submitted

#### Database Schema

**Profiles Table**:
```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  first_name text,
  last_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Auto Profile Creation**:
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  INSERT INTO public.projects (owner_id, name, is_general)
  VALUES (NEW.id, 'General', true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_user_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

#### Session Management

**Supabase Configuration** (`packages/data/supabase.ts`):
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,        // Persist sessions
    autoRefreshToken: true,       // Auto-refresh tokens
    persistSession: true,         // Keep session across app restarts
    detectSessionInUrl: true,     // Parse OAuth callback tokens
  },
});
```

#### Data Layer

**Auth Service** (`packages/data/services/authService.ts`):
- `getSession()`: Gets current session
- Auth state change listener for debugging

**Profile Service** (`packages/data/services/profileService.ts`):
- `getCurrentProfile()`: Gets current user's profile
- `updateProfile({ firstName })`: Updates first name

**React Query Hooks** (`packages/data/hooks/useAuth.ts`, `packages/data/hooks/useProfile.ts`):
- `useSession()`: Session state management
- `useCurrentProfile()`: Profile data fetching
- `useUpdateProfile()`: Profile updates with cache invalidation

### Key Configuration

#### Environment Variables
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_WEB_CLIENT_ID=your-web-client-id
```

#### Google OAuth Setup
1. Google Cloud Console project configured
2. OAuth 2.0 client IDs created for web
3. Authorized redirect URIs configured
4. Supabase Google provider configured with client ID/secret

### What Makes It Work

The critical fix was enabling `detectSessionInUrl: true` in the Supabase client configuration. This allows Supabase to automatically parse the OAuth callback tokens from the URL after Google redirects back to the app, establishing the session properly.

### Error Handling

- Session persistence via AsyncStorage
- Auth state change listeners for real-time updates
- React Query cache invalidation on auth state changes
- Comprehensive error logging and debugging

### Testing the Flow

1. **New User**: Login → WelcomeModal appears → Enter name → Continue → Main app
2. **Returning User**: Login → Directly to main app (no modal)
3. **Logout**: Click logout button → Returns to login screen
4. **Session Persistence**: Close/reopen app → Stays logged in

The system is now fully operational with a simple, reliable authentication flow.