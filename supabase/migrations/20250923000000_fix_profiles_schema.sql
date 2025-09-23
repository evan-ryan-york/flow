-- Fix profiles table schema to match build-spec and remove email column
-- This migration adds full_name column and removes email column as requested

-- Add full_name column to profiles table
ALTER TABLE public.profiles ADD COLUMN full_name text;

-- Remove email column as it's redundant (email is stored in auth.users)
ALTER TABLE public.profiles DROP COLUMN email;

-- Update the trigger function to not insert email and prepare for full_name onboarding
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile with avatar_url from Google metadata, but without full_name to trigger onboarding
  INSERT INTO public.profiles (id, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Create the "General" project for the new user
  INSERT INTO public.projects (owner_id, name, is_general)
  VALUES (NEW.id, 'General', true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;