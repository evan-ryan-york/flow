# SQL Create Statements

-- Table: profiles
-- Purpose: Stores public user information and a pointer to their avatar.
CREATE TABLE profiles (
  -- The primary key, which is also a foreign key to the auth.users table.
  "id" uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  "first_name" text,
  "last_name" text,
  -- The email column has been removed to avoid duplication.
  -- The authoritative email is in the auth.users table.

  -- A text field to store the URL or path to the user's avatar in Supabase Storage.
  "avatar_url" text,

  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

-- Table: projects
-- Purpose: Stores project details, including the special "General" project for each user.
CREATE TABLE projects (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to the user who owns the project.
  "owner_id" uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  "name" text NOT NULL,

  -- Identifies the default, non-deletable "General" project for a user.
  "is_general" boolean NOT NULL DEFAULT false,

  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

-- Table: project_users
-- Purpose: Manages user access to projects.
CREATE TABLE project_users (
  -- Composite primary key ensures a user can't be in the same project twice.
  "project_id" uuid REFERENCES projects(id) ON DELETE CASCADE,
  "user_id" uuid REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id),

  -- Role can be expanded later (e.g., 'admin', 'viewer').
  "role" text NOT NULL DEFAULT 'member',

  "joined_at" timestamp with time zone DEFAULT now()
);

-- Table: tasks
-- Purpose: Stores individual task items.
CREATE TABLE tasks (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Every task must belong to a project, including the user's "General" project.
  "project_id" uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  "created_by" uuid NOT NULL REFERENCES profiles(id),
  "assigned_to" uuid REFERENCES profiles(id),

  "name" text NOT NULL,
  "description" text, -- Markdown-enabled text field
  "due_date" date,

  -- A simple boolean to quickly filter for completed vs. uncompleted tasks.
  "is_completed" boolean NOT NULL DEFAULT false,

  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

-- Table: custom_property_definitions
-- Purpose: Defines the available custom fields for a project.
CREATE TABLE custom_property_definitions (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  "project_id" uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Tracks which user created the property definition.
  "created_by" uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  "name" text NOT NULL, -- e.g., "Environment", "Priority"
  "type" text NOT NULL CHECK (type IN ('text', 'select', 'date', 'number')),

  -- For 'select' type, this stores the available choices.
  "options" jsonb,

  -- For ordering properties in the UI.
  "display_order" smallint NOT NULL DEFAULT 0,

  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),

  -- A project cannot have two properties with the same name.
  UNIQUE (project_id, name)
);

-- Table: custom_property_values
-- Purpose: Stores the value of a custom field for a specific task.
CREATE TABLE custom_property_values (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  "task_id" uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  "definition_id" uuid NOT NULL REFERENCES custom_property_definitions(id) ON DELETE CASCADE,

  -- All values stored as text; application layer handles casting.
  "value" text NOT NULL,

  "created_by" uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "updated_by" uuid REFERENCES profiles(id) ON DELETE SET NULL,

  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),

  -- A task can only have one value for any given property definition.
  UNIQUE (task_id, definition_id)
);

-- Table: views
-- Purpose: Stores user-defined saved views.
CREATE TABLE views (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  "user_id" uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  "name" text NOT NULL,
  "type" text NOT NULL CHECK (type IN ('list', 'kanban')),

  -- jsonb is perfect for storing flexible configuration data.
  "config" jsonb NOT NULL,

  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

-- Table: time_blocks
-- Purpose: Stores calendar time blocks for planning.
CREATE TABLE time_blocks (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  "user_id" uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- For robust two-way sync with Google Calendar.
  "google_calendar_event_id" text UNIQUE,

  "title" text NOT NULL DEFAULT 'Focus Time',
  "start_time" timestamp with time zone NOT NULL,
  "end_time" timestamp with time zone NOT NULL,

  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

-- Table: time_block_tasks
-- Purpose: Associates tasks with specific time blocks.
CREATE TABLE time_block_tasks (
  -- Composite primary key to prevent duplicate entries.
  "time_block_id" uuid REFERENCES time_blocks(id) ON DELETE CASCADE,
  "task_id" uuid REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (time_block_id, task_id),

  "added_at" timestamp with time zone DEFAULT now()
);
