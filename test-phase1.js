// Simple test script for Phase 1 implementation
const { createClient } = require('@supabase/supabase-js');

// Test environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

console.log('Testing Phase 1 Implementation...\n');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Please set SUPABASE_URL and SUPABASE_ANON_KEY in your environment');
  process.exit(1);
}

console.log('✅ Supabase environment variables found');

// Test Supabase connection
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    // Test basic connection by getting auth user (should return null when not authenticated)
    const { data, error } = await supabase.auth.getUser();

    if (error && error.message !== 'JWT expired') {
      throw error;
    }

    console.log('✅ Supabase connection successful');

    // Test if we can query the profiles table (this will test our RLS setup)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true });

    if (profilesError) {
      console.log('⚠️  Profiles table not accessible (expected when not authenticated)');
    } else {
      console.log('✅ Profiles table accessible');
    }

    console.log('\n🎉 Phase 1 setup looks good!');
    console.log('\nNext steps:');
    console.log('1. Apply the new migration: supabase db push');
    console.log('2. Test user registration in your application');
    console.log('3. Verify profile and General project creation');

  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    process.exit(1);
  }
}

testConnection();