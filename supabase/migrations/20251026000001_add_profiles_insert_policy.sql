-- Add INSERT policy for profiles table
-- This allows the handle_new_user trigger to insert new profiles
-- The trigger uses SECURITY DEFINER so it runs with elevated privileges

-- First, check if a similar policy exists and drop it
DROP POLICY IF EXISTS "Allow service role to insert profiles" ON profiles;
DROP POLICY IF EXISTS "System can create profiles" ON profiles;

-- Create a policy that allows inserts for new users
-- This policy allows anyone to insert their own profile (auth.uid() = id)
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);
