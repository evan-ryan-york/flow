-- Migration: Add account deletion function
-- Deletes all user data across all tables, respecting foreign key constraints
-- Called via Edge Function with service role key

CREATE OR REPLACE FUNCTION delete_user_data(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Calendar-related (calendar_connections was renamed from google_calendar_connections)
  DELETE FROM calendar_events WHERE user_id = target_user_id;
  DELETE FROM calendar_sync_state WHERE user_id = target_user_id;
  DELETE FROM calendar_subscriptions WHERE connection_id IN (
    SELECT id FROM calendar_connections WHERE user_id = target_user_id
  );
  DELETE FROM calendar_connections WHERE user_id = target_user_id;
  DELETE FROM oauth_state_tokens WHERE user_id = target_user_id;

  -- Time blocks (must delete join table first)
  DELETE FROM time_block_tasks WHERE time_block_id IN (
    SELECT id FROM time_blocks WHERE user_id = target_user_id
  );
  DELETE FROM time_blocks WHERE user_id = target_user_id;

  -- Custom property values (on tasks the user created)
  DELETE FROM custom_property_values WHERE task_id IN (
    SELECT id FROM tasks WHERE created_by = target_user_id
  );

  -- Tasks
  DELETE FROM tasks WHERE created_by = target_user_id;

  -- Custom property project assignments (for projects the user owns)
  DELETE FROM custom_property_project_assignments WHERE project_id IN (
    SELECT id FROM projects WHERE owner_id = target_user_id
  );

  -- Custom property definitions
  DELETE FROM custom_property_definitions WHERE created_by = target_user_id;

  -- Views
  DELETE FROM views WHERE user_id = target_user_id;

  -- Project memberships (both as member and for owned projects)
  DELETE FROM project_users WHERE user_id = target_user_id;
  DELETE FROM project_users WHERE project_id IN (
    SELECT id FROM projects WHERE owner_id = target_user_id
  );

  -- Projects
  DELETE FROM projects WHERE owner_id = target_user_id;

  -- Profile (has ON DELETE CASCADE from auth.users, but delete explicitly for clarity)
  DELETE FROM profiles WHERE id = target_user_id;
END;
$$;
