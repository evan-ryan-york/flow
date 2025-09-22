-- Phase 1: User Foundation & Authentication
-- This migration sets up the profiles table, updates the projects table,
-- and creates a trigger to automatically create user data on signup

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS projects;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  email text NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create projects table with enhanced schema
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_general boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create project_users join table for collaboration
CREATE TABLE project_users (
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  joined_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (project_id, user_id)
);

-- Create tasks table (updated schema)
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  due_date date,
  status text DEFAULT 'todo' NOT NULL,
  is_completed boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Function to automatically create profile and General project for new users
CREATE OR REPLACE FUNCTION create_initial_user_data()
RETURNS trigger AS $$
BEGIN
  -- Insert profile
  INSERT INTO profiles (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, now(), now());

  -- Insert "General" project for the new user
  INSERT INTO projects (owner_id, name, is_general, created_at, updated_at)
  VALUES (NEW.id, 'General', true, now(), now());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function when a user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_initial_user_data();

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Projects RLS policies
CREATE POLICY "Users can view their own projects" ON projects
  FOR SELECT USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_users
      WHERE project_id = projects.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create projects" ON projects
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Project owners can update their projects" ON projects
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Project owners can delete their projects" ON projects
  FOR DELETE USING (owner_id = auth.uid());

-- Project users RLS policies
CREATE POLICY "Users can view project memberships" ON project_users
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can manage project users" ON project_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id AND owner_id = auth.uid()
    )
  );

-- Tasks RLS policies
CREATE POLICY "Users can view tasks in their projects" ON tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id
      AND (
        owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_users
          WHERE project_id = projects.id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can create tasks in their projects" ON tasks
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id
      AND (
        owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_users
          WHERE project_id = projects.id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can update tasks in their projects" ON tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id
      AND (
        owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_users
          WHERE project_id = projects.id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can delete tasks in their projects" ON tasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id
      AND (
        owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_users
          WHERE project_id = projects.id AND user_id = auth.uid()
        )
      )
    )
  );