-- Fix Views RLS Policies
-- The views table has RLS enabled but no active policies
-- This migration restores the necessary policies for views CRUD operations

-- Drop any existing views policies (idempotent)
DROP POLICY IF EXISTS "Users can manage their own views" ON views;
DROP POLICY IF EXISTS "Users can view their own views" ON views;
DROP POLICY IF EXISTS "Users can create their own views" ON views;
DROP POLICY IF EXISTS "Users can update their own views" ON views;
DROP POLICY IF EXISTS "Users can delete their own views" ON views;

-- Create separate policies for each operation (more explicit than FOR ALL)
CREATE POLICY "Users can view their own views" ON views
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own views" ON views
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own views" ON views
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own views" ON views
  FOR DELETE USING (user_id = auth.uid());
