-- Add INSERT policies for calendar tables to allow users to create their own data
-- This migration addresses RLS test failures by enabling INSERT operations

-- Allow users to insert their own calendar connections
CREATE POLICY "Users can insert their own calendar connections"
ON google_calendar_connections
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to insert subscriptions for their own connections
CREATE POLICY "Users can insert subscriptions for own connections"
ON calendar_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM google_calendar_connections
    WHERE id = connection_id AND user_id = auth.uid()
  )
);

-- Allow users to insert events for their own subscriptions
CREATE POLICY "Users can insert events for own subscriptions"
ON calendar_events
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM calendar_subscriptions
    WHERE id = subscription_id AND user_id = auth.uid()
  )
);
