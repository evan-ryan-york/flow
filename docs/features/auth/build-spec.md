Feature Build Spec: Google Authentication & User Onboarding
Feature: Google-Only Sign-In & New User Welcome
Last Updated: September 22, 2025, 09:07 AM EDT
Status: Ready for Development

1. Overview & Goal
This feature implements the complete authentication flow for the application, exclusively using "Sign in with Google." The primary goal is to provide a frictionless entry point for both new and returning users. For new users, the system must seamlessly create an account, capture essential profile information from Google, and guide them through a one-step name confirmation process before granting access to the main application.

2. Jobs to be Done (JTBD)
For New Users: When I first open the app, I want to create an account using my Google credentials in one click, so I can start using the application immediately without the friction of creating and remembering a new password.

For Returning Users: When I open the app, I want to sign in securely with my Google account, so I can access my tasks and projects instantly.

For the System (Onboarding): When a new user signs up, I want to capture their identity (name, email, avatar) and confirm their preferred name, so their profile is personalized from the very first session.

3. User Flow & System Logic
The system must handle two distinct paths after a successful Google OAuth authentication: the "New User Onboarding" flow and the "Existing User Login" flow. The determination of which path to take is based on whether the user's corresponding record in the profiles table has a full_name set.

Detailed Flow:
Initiation: The user, on the LoginScreen, clicks the "Sign in with Google" button.

OAuth Handshake: The application, using expo-auth-session, initiates the native Google OAuth flow. The user selects their Google account and grants permission.

Token Reception: The app receives an id_token from Google upon successful authentication.

Supabase Authentication: The app passes this id_token to the Supabase client via supabase.auth.signInWithIdToken().

Backend Account Creation (Trigger):

Supabase verifies the token with Google.

If this is the user's first time signing in, Supabase automatically creates a new record for them in the auth.users table.

A database trigger we will create (on_new_user_create_profile) immediately fires, creating a corresponding row in the public.profiles table. This new row will have the user's id, email, and avatar_url (from Google's metadata), but the full_name will be NULL.

Critical Fork (In-App Logic):

After the successful Supabase sign-in, the app's root layout (_layout.tsx) detects an authenticated session.

The app immediately calls the useCurrentProfile hook to fetch the user's profile from the public.profiles table.

The system checks if profile.full_name is NULL or an empty string.

Path A: New User (profile.full_name is NULL):

The user is directed to the main app screen.

A WelcomeModal is immediately presented as an overlay.

The modal displays an input field for "Your Name," which is pre-populated with the display_name from the Google user metadata. The user can edit this name.

The user clicks "Continue."

The app calls the updateProfile mutation, saving the confirmed name to the full_name column in their profiles row.

Upon successful mutation, the modal closes, revealing the fully interactive home page.

Path B: Existing User (profile.full_name has a value):

The user is directed to the main app screen.

No modal is shown. The user can immediately begin interacting with the application.

4. What to Build: Component & Data Layer Breakdown
UI Layer (apps/mobile/)
app/(auth)/login.tsx (Login Screen)

Responsibility: Display the single entry point into the app for unauthenticated users.

Components:

A single, prominent "Sign in with Google" button.

A loading indicator to show while the promptAsync function is active.

Logic:

Utilize expo-auth-session/providers/google's useAuthRequest hook to manage the OAuth flow.

An effect (useEffect) will listen for a successful response from the hook.

On success, it will extract the id_token and call supabase.auth.signInWithIdToken.

app/(app)/_layout.tsx (Main App Layout)

Responsibility: Act as the gatekeeper and orchestrator for the post-login experience.

Logic:

Calls the useCurrentProfile hook.

Renders the main app content (<Slot />).

Conditionally renders the WelcomeModal based on the result of the profile query (!profile.full_name && !isLoading).

components/WelcomeModal.tsx

Responsibility: Onboard new users by confirming their name.

Props: isVisible: boolean, defaultName: string, onContinue: (name: string) => void.

Components: A modal view containing:

Welcome message ("Welcome to Project Unify!").

A text input pre-filled with defaultName.

A "Continue" button.

Logic:

Manages the state of the name input field.

The "Continue" button is disabled if the input is empty.

Calls the onContinue prop when the button is pressed.

Data Layer (packages/data/)
services/authService.ts

signInWithGoogleIdToken(token: string): A new function that takes the id_token and calls supabase.auth.signInWithIdToken().

The existing signInWithGoogle will be removed or refactored to be part of the client-side logic in the login.tsx screen, as the service layer shouldn't depend on expo-auth-session.

services/profileService.ts

getCurrentProfile(): Fetches the profile for the currently logged-in user. select('*').single().

updateProfile({ fullName: string }): Updates the full_name for the current user's profile.

hooks/useProfile.ts

useCurrentProfile(): A useQuery hook that wraps profileService.getCurrentProfile. This is the hook used by the layout to check for onboarding.

useUpdateProfile(): A useMutation hook that wraps profileService.updateProfile. It must invalidate the ['profile', userId] query on success to ensure the WelcomeModal disappears.

5. Required Backend Logic (Supabase)
The automatic creation of a user profile is critical. This is achieved with a PostgreSQL function and a trigger.

SQL Migration (supabase/migrations/...sql)

SQL

-- Creates a trigger function that fires on new user sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserts a new row into the public.profiles table
  -- raw_user_meta_data contains the full name, avatar, etc. from Google
  INSERT INTO public.profiles (id, full_name, avatar_url, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Configures the trigger to fire after a new user is inserted into auth.users
CREATE TRIGGER on_new_user_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- We need to adjust the function to handle the case where a user signs up
-- but the name isn't available, which is our trigger for the modal.
-- Let's refine the function to insert NULL for the name, to force the modal flow.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, avatar_url, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'avatar_url',
    new.email
  );
  -- Also create the "General" project for the new user
  INSERT INTO public.projects (owner_id, project_name, is_general)
  VALUES (new.id, 'General', true);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
Note: The refined trigger intentionally omits full_name. The app will get the name from the client-side Google auth response and use it to pre-populate the welcome modal, giving the user a chance to edit it before the first save. This also simplifies the trigger and reliably forces the onboarding flow for every new user.

6. Testing Strategy: Definition of "Operational"
The feature is considered operational and complete when the following tests are written and passing.

Service Layer Integration Tests (packages/data/__tests__/)
profileService.test.ts:

updateProfile: Test that an authenticated user can successfully update their own full_name.

RLS Check: Test that updateProfile throws an error or fails silently when User A attempts to update User B's profile.

Hook Layer Unit Tests (packages/data/__tests__/)
useProfile.test.ts:

Mock the profileService.

Test that useCurrentProfile correctly returns isLoading, isError, and data states.

Test that useUpdateProfile's onSuccess callback successfully invalidates the useCurrentProfile query.

End-to-End (E2E) Tests (Detox/Cypress)
These are the most critical tests and define the "happy path" success criteria.

Critical Journey 1: New User Onboarding

Given I am a new user who has never logged in.

When I launch the app and tap "Sign in with Google".

And I successfully authenticate with my Google account.

Then I should be taken to the main app screen.

And a "Welcome" modal must be visible.

And the name input in the modal should be pre-filled with my Google display name.

When I edit the name and tap "Continue".

Then the modal should disappear, and I can interact with the home page.

And if I close and reopen the app, the modal should not reappear.

Critical Journey 2: Existing User Login

Given I am an existing user who has completed the onboarding.

When I launch the app and tap "Sign in with Google".

And I successfully authenticate with my Google account.

Then I should be taken directly to the main app screen.

And the "Welcome" modal must not be visible.

7. Out of Scope for this Feature
Email/Password authentication.

Any other social providers (Apple, GitHub, etc.).

A dedicated "Profile" screen for changing the name or avatar after onboarding.

"Forgot Password" or "Change Email" flows (not applicable).