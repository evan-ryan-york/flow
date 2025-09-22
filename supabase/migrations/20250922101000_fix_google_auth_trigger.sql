-- Fix Google Authentication Trigger to Match Build-spec Exactly
-- This migration corrects the function name and trigger name to match build-spec requirements

-- Drop the old function and create the correctly named one
DROP FUNCTION IF EXISTS create_initial_user_data() CASCADE;

-- Create the trigger function with the exact name specified in build-spec
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile with avatar_url from Google metadata, but without full_name to trigger onboarding
  INSERT INTO public.profiles (id, avatar_url, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  );

  -- Create the "General" project for the new user
  INSERT INTO public.projects (owner_id, name, is_general)
  VALUES (NEW.id, 'General', true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the old trigger and create the correctly named one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger with the exact name specified in build-spec
CREATE TRIGGER on_new_user_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();