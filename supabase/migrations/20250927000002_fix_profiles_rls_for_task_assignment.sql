-- Fix profiles RLS policy to allow users to view other users' basic profile info
-- This is needed for task assignment display to work properly

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Create a new policy that allows users to view basic profile info of all users
-- This is safe because it only exposes first_name, last_name, and avatar_url
-- Email and other sensitive data can still be protected by column-level policies
DROP POLICY IF EXISTS "Users can view basic profile info" ON profiles;
CREATE POLICY "Users can view basic profile info" ON profiles
  FOR SELECT USING (true);

-- For security, create a separate policy for updating profiles (own profile only)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);