import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Test Supabase configuration
// In a real implementation, these would come from environment variables for your test database
const SUPABASE_URL = process.env.SUPABASE_TEST_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY || 'your-test-anon-key';

export const createTestSupabaseClient = (): SupabaseClient => {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
};

// Helper to create a test user
export const createTestUser = async (client: SupabaseClient, email: string, password: string) => {
  const { data, error } = await client.auth.signUp({
    email,
    password,
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  return data;
};

// Helper to clean up test data
export const cleanupTestData = async (client: SupabaseClient) => {
  // Sign out any authenticated user
  await client.auth.signOut();

  // In a real implementation, you would clean up test data here
  // This might involve calling stored procedures or admin functions
  // to remove test users and their associated data
};

// Helper to authenticate as a test user
export const signInTestUser = async (client: SupabaseClient, email: string, password: string) => {
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`Failed to sign in test user: ${error.message}`);
  }

  return data;
};