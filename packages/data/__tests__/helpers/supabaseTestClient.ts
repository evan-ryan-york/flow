import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

// Test Supabase configuration - connects to production Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ewuhxqbfwbenkhnkzokp.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dWh4cWJmd2Jlbmtobmt6b2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NTAzMjIsImV4cCI6MjA3NDAyNjMyMn0.2UiFSCR2dUumXQMo2qSkqJBVPTOjx0BphdcZWZEqea8';

// Global test client instance
let testClient: SupabaseClient | null = null;

// Track created test users for cleanup
const createdTestUsers: User[] = [];

export const createTestSupabaseClient = (): SupabaseClient => {
  if (!testClient) {
    testClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return testClient;
};

export const getTestClient = (): SupabaseClient => {
  return createTestSupabaseClient();
};

/**
 * Create a test user with a unique email based on timestamp
 */
export const createTestUser = async (
  client: SupabaseClient,
  emailPrefix: string = 'testuser'
): Promise<{ user: User; email: string; password: string }> => {
  const timestamp = Date.now().toString().slice(-8); // Last 8 digits
  const random = Math.floor(Math.random() * 1000);
  const email = `test-${timestamp}-${random}@example.com`;
  const password = 'TestPassword123!';

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: undefined,
      data: {
        test_user: true,
        email_confirm: true, // Auto-confirm for test users
      },
    },
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  if (!data.user) {
    throw new Error('No user returned from signup');
  }

  createdTestUsers.push(data.user);

  return {
    user: data.user,
    email,
    password,
  };
};

/**
 * Create multiple test users at once
 */
export const createTestUsers = async (
  count: number
): Promise<Array<{ user: User; email: string; password: string; client: SupabaseClient }>> => {
  const users = [];

  for (let i = 0; i < count; i++) {
    // Create a new client for each user to maintain separate auth contexts
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const userData = await createTestUser(userClient, `testuser${i}`);

    users.push({
      ...userData,
      client: userClient,
    });
  }

  return users;
};

/**
 * Authenticate as a specific test user
 */
export const signInTestUser = async (
  client: SupabaseClient,
  email: string,
  password: string
) => {
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`Failed to sign in test user: ${error.message}`);
  }

  return data;
};

/**
 * Switch authentication context to a different user
 * This creates a new client authenticated as the specified user
 */
export const authenticateAs = async (
  email: string,
  password: string
): Promise<SupabaseClient> => {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  await signInTestUser(client, email, password);

  return client;
};

/**
 * Clean up test data
 * NOTE: This is a simplified version. In production, you'd want to delete
 * all data created by test users (projects, tasks, etc.)
 */
export const cleanupTestData = async (client: SupabaseClient) => {
  // Sign out the current user
  await client.auth.signOut();
};

/**
 * Delete all data for a specific test user
 * WARNING: Use only in test environments!
 */
export const deleteTestUserData = async (client: SupabaseClient, userId: string) => {
  // Delete user's projects (cascade will handle tasks, etc.)
  await client.from('projects').delete().eq('owner_id', userId);

  // Delete any project memberships
  await client.from('project_users').delete().eq('user_id', userId);

  // Delete user profile
  await client.from('profiles').delete().eq('id', userId);

  // Sign out
  await client.auth.signOut();
};

/**
 * Global cleanup - call this in afterAll() hooks
 */
export const globalCleanup = async () => {
  // Clean up all created test users
  for (const user of createdTestUsers) {
    try {
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      await deleteTestUserData(client, user.id);
    } catch (error) {
      console.error(`Failed to clean up user ${user.id}:`, error);
    }
  }

  createdTestUsers.length = 0; // Clear the array
  testClient = null;
};
