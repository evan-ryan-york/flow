-- Update the new user trigger to include General project in visible_project_ids
-- This ensures new users see their General project by default

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  general_project_id uuid;
BEGIN
  -- Create the "General" project for the new user and capture its ID
  INSERT INTO public.projects (owner_id, name, is_general)
  VALUES (NEW.id, 'General', true)
  RETURNING id INTO general_project_id;

  -- Insert profile with General project in visible_project_ids
  INSERT INTO public.profiles (id, avatar_url, email, visible_project_ids)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email,
    jsonb_build_array(general_project_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;