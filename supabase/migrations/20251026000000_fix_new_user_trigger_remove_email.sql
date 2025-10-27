-- Fix handle_new_user trigger to remove email column reference
-- The email column was removed from profiles table in earlier migration
-- IMPORTANT: Insert profile FIRST, then project (due to foreign key constraint)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  general_project_id uuid;
BEGIN
  -- Insert profile FIRST (projects has FK to profiles)
  -- Note: email column was removed, it's stored in auth.users only
  INSERT INTO public.profiles (id, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Now create the "General" project and capture its ID
  INSERT INTO public.projects (owner_id, name, is_general)
  VALUES (NEW.id, 'General', true)
  RETURNING id INTO general_project_id;

  -- Update profile with General project in visible_project_ids
  UPDATE public.profiles
  SET visible_project_ids = jsonb_build_array(general_project_id)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
