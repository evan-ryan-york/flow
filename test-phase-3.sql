-- Phase 3 Database Verification Queries
-- Run these in Supabase SQL Editor to verify Phase 3 setup

-- ============================================
-- 1. VERIFY TABLES EXIST
-- ============================================

SELECT 'Checking if all required tables exist...' as step;

SELECT
  table_name,
  CASE
    WHEN table_name IN (
      'oauth_state_tokens',
      'google_calendar_connections',
      'calendar_subscriptions',
      'calendar_events',
      'calendar_sync_state'
    ) THEN '✅'
    ELSE '❌'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'oauth_state_tokens',
    'google_calendar_connections',
    'calendar_subscriptions',
    'calendar_events',
    'calendar_sync_state'
  )
ORDER BY table_name;

-- ============================================
-- 2. VERIFY RLS POLICIES
-- ============================================

SELECT 'Checking RLS policies...' as step;

SELECT
  schemaname,
  tablename,
  policyname,
  CASE
    WHEN cmd IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE') THEN '✅'
    ELSE '❌'
  END as policy_type
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'oauth_state_tokens',
    'google_calendar_connections',
    'calendar_subscriptions',
    'calendar_events',
    'calendar_sync_state'
  )
ORDER BY tablename, cmd;

-- Count policies per table
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'oauth_state_tokens',
    'google_calendar_connections',
    'calendar_subscriptions',
    'calendar_events',
    'calendar_sync_state'
  )
GROUP BY tablename
ORDER BY tablename;

-- ============================================
-- 3. VERIFY INDEXES
-- ============================================

SELECT 'Checking indexes...' as step;

SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'oauth_state_tokens',
    'google_calendar_connections',
    'calendar_subscriptions',
    'calendar_events',
    'calendar_sync_state'
  )
ORDER BY tablename, indexname;

-- ============================================
-- 4. VERIFY FOREIGN KEY CONSTRAINTS
-- ============================================

SELECT 'Checking foreign key constraints...' as step;

SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  '✅' as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'oauth_state_tokens',
    'google_calendar_connections',
    'calendar_subscriptions',
    'calendar_events',
    'calendar_sync_state'
  )
ORDER BY tc.table_name, kcu.column_name;

-- ============================================
-- 5. VERIFY TRIGGERS (updated_at)
-- ============================================

SELECT 'Checking triggers...' as step;

SELECT
  event_object_table as table_name,
  trigger_name,
  event_manipulation as trigger_event,
  '✅' as status
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN (
    'google_calendar_connections',
    'calendar_subscriptions',
    'calendar_events',
    'calendar_sync_state'
  )
ORDER BY event_object_table, trigger_name;

-- ============================================
-- 6. VERIFY COLUMN STRUCTURE
-- ============================================

SELECT 'Checking google_calendar_connections columns...' as step;

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'google_calendar_connections'
ORDER BY ordinal_position;

SELECT 'Checking calendar_subscriptions columns...' as step;

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'calendar_subscriptions'
ORDER BY ordinal_position;

SELECT 'Checking calendar_events columns...' as step;

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'calendar_events'
ORDER BY ordinal_position;

-- ============================================
-- 7. CHECK CURRENT DATA (if any)
-- ============================================

SELECT 'Checking current data...' as step;

SELECT 'OAuth State Tokens' as table_name, COUNT(*) as record_count FROM oauth_state_tokens
UNION ALL
SELECT 'Calendar Connections', COUNT(*) FROM google_calendar_connections
UNION ALL
SELECT 'Calendar Subscriptions', COUNT(*) FROM calendar_subscriptions
UNION ALL
SELECT 'Calendar Events', COUNT(*) FROM calendar_events
UNION ALL
SELECT 'Calendar Sync State', COUNT(*) FROM calendar_sync_state;

-- ============================================
-- 8. VERIFY FUNCTIONS EXIST
-- ============================================

SELECT 'Checking custom functions...' as step;

SELECT
  routine_name,
  routine_type,
  '✅' as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'cleanup_expired_oauth_tokens';

-- ============================================
-- 9. CHECK CRON JOBS (if pg_cron is installed)
-- ============================================

SELECT 'Checking cron jobs (if pg_cron installed)...' as step;

-- This will error if pg_cron is not installed - that's okay
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    RAISE NOTICE 'pg_cron is installed ✅';
  ELSE
    RAISE NOTICE 'pg_cron is NOT installed - cron jobs need manual setup';
  END IF;
END $$;

-- If pg_cron is installed, list jobs
-- SELECT * FROM cron.job;

-- ============================================
-- 10. SAMPLE QUERIES FOR TESTING
-- ============================================

-- Replace YOUR_USER_ID with actual user ID for testing

/*
-- Get your user ID:
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Check connections for a user:
SELECT
  id,
  email,
  label,
  expires_at,
  requires_reauth,
  created_at
FROM google_calendar_connections
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC;

-- Check calendar subscriptions:
SELECT
  cs.calendar_name,
  cs.is_visible,
  cs.sync_enabled,
  cs.background_color,
  gcc.email as account_email
FROM calendar_subscriptions cs
JOIN google_calendar_connections gcc ON cs.connection_id = gcc.id
WHERE gcc.user_id = 'YOUR_USER_ID'
ORDER BY cs.calendar_name;

-- Check synced events:
SELECT
  ce.title,
  ce.start_time,
  ce.end_time,
  ce.is_all_day,
  ce.location,
  cs.calendar_name,
  gcc.email as account_email
FROM calendar_events ce
JOIN calendar_subscriptions cs ON ce.subscription_id = cs.id
JOIN google_calendar_connections gcc ON ce.connection_id = gcc.id
WHERE gcc.user_id = 'YOUR_USER_ID'
ORDER BY ce.start_time DESC
LIMIT 20;

-- Check sync state (incremental sync tokens):
SELECT
  cs.calendar_name,
  css.last_sync_at,
  css.sync_token IS NOT NULL as has_incremental_sync,
  gcc.email as account_email
FROM calendar_sync_state css
JOIN calendar_subscriptions cs ON css.subscription_id = cs.id
JOIN google_calendar_connections gcc ON cs.connection_id = gcc.id
WHERE gcc.user_id = 'YOUR_USER_ID'
ORDER BY css.last_sync_at DESC;

-- Complete overview query:
SELECT
  gcc.email as account,
  cs.calendar_name,
  cs.is_visible,
  COUNT(ce.id) as event_count,
  MAX(ce.last_synced_at) as last_event_sync,
  css.last_sync_at as last_calendar_sync,
  css.sync_token IS NOT NULL as has_incremental_sync
FROM google_calendar_connections gcc
LEFT JOIN calendar_subscriptions cs ON cs.connection_id = gcc.id
LEFT JOIN calendar_events ce ON ce.subscription_id = cs.id
LEFT JOIN calendar_sync_state css ON css.subscription_id = cs.id
WHERE gcc.user_id = 'YOUR_USER_ID'
GROUP BY gcc.id, gcc.email, cs.id, cs.calendar_name, cs.is_visible, css.last_sync_at, css.sync_token
ORDER BY gcc.created_at, cs.calendar_name;
*/

-- ============================================
-- 11. PERFORMANCE CHECK
-- ============================================

SELECT 'Checking query performance...' as step;

-- Analyze event query performance (replace YOUR_USER_ID)
/*
EXPLAIN ANALYZE
SELECT * FROM calendar_events
WHERE user_id = 'YOUR_USER_ID'
  AND start_time >= NOW()
  AND start_time <= NOW() + INTERVAL '7 days'
ORDER BY start_time;
*/

-- ============================================
-- 12. CLEANUP EXPIRED OAUTH TOKENS (TEST)
-- ============================================

SELECT 'Testing cleanup function...' as step;

-- Count expired tokens
SELECT COUNT(*) as expired_tokens
FROM oauth_state_tokens
WHERE expires_at < NOW();

-- Run cleanup function
-- SELECT cleanup_expired_oauth_tokens();

-- Verify cleanup worked
-- SELECT COUNT(*) as remaining_expired_tokens
-- FROM oauth_state_tokens
-- WHERE expires_at < NOW();

-- ============================================
-- SUMMARY
-- ============================================

SELECT 'Phase 3 Database Verification Complete!' as summary;

SELECT
  'Tables Created' as check_item,
  COUNT(DISTINCT table_name) || '/5' as result,
  CASE WHEN COUNT(DISTINCT table_name) = 5 THEN '✅' ELSE '❌' END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'oauth_state_tokens',
    'google_calendar_connections',
    'calendar_subscriptions',
    'calendar_events',
    'calendar_sync_state'
  )
UNION ALL
SELECT
  'RLS Policies Created' as check_item,
  COUNT(*) || ' policies' as result,
  CASE WHEN COUNT(*) >= 14 THEN '✅' ELSE '⚠️' END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'oauth_state_tokens',
    'google_calendar_connections',
    'calendar_subscriptions',
    'calendar_events',
    'calendar_sync_state'
  )
UNION ALL
SELECT
  'Foreign Keys Created' as check_item,
  COUNT(*) || ' constraints' as result,
  CASE WHEN COUNT(*) >= 7 THEN '✅' ELSE '⚠️' END as status
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
  AND table_schema = 'public'
  AND table_name IN (
    'oauth_state_tokens',
    'google_calendar_connections',
    'calendar_subscriptions',
    'calendar_events',
    'calendar_sync_state'
  )
UNION ALL
SELECT
  'Indexes Created' as check_item,
  COUNT(*) || ' indexes' as result,
  CASE WHEN COUNT(*) >= 15 THEN '✅' ELSE '⚠️' END as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'oauth_state_tokens',
    'google_calendar_connections',
    'calendar_subscriptions',
    'calendar_events',
    'calendar_sync_state'
  )
UNION ALL
SELECT
  'Triggers Created' as check_item,
  COUNT(DISTINCT event_object_table) || '/4 tables' as result,
  CASE WHEN COUNT(DISTINCT event_object_table) = 4 THEN '✅' ELSE '⚠️' END as status
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN (
    'google_calendar_connections',
    'calendar_subscriptions',
    'calendar_events',
    'calendar_sync_state'
  );
