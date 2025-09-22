-- Google Authentication & User Onboarding Migration
-- This migration updates the profiles table and trigger for Google-only auth flow

-- Add full_name column to profiles table for onboarding detection
ALTER TABLE profiles ADD COLUMN full_name text;

-- Update the trigger function to support Google auth onboarding flow
-- The refined trigger intentionally omits full_name, forcing onboarding for every new user
CREATE OR REPLACE FUNCTION create_initial_user_data()
RETURNS trigger AS $$
BEGIN
  -- Insert profile with avatar_url from Google metadata, but without full_name to trigger onboarding
  INSERT INTO profiles (id, email, avatar_url, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    now(),
    now()
  );

  -- Create the "General" project for the new user
  INSERT INTO projects (owner_id, name, is_general, created_at, updated_at)
  VALUES (NEW.id, 'General', true, now(), now());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger already exists from the previous migration, so we don't need to recreate it
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION create_initial_user_data();