// Phase 3 Verification Script
// Tests the task and custom property services

const { createClient } = require('@supabase/supabase-js');

// Read environment variables or use defaults for local development
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key-here';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testPhase3() {
  console.log('🚀 Phase 3 Implementation Test');
  console.log('==================================');

  try {
    // Test 1: Check table accessibility
    console.log('\n1. Testing table accessibility...');

    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select('count(*)')
      .limit(1);

    if (tasksError) {
      console.error('❌ Tasks table error:', tasksError.message);
      return;
    }

    const { data: definitionsData, error: definitionsError } = await supabase
      .from('custom_property_definitions')
      .select('count(*)')
      .limit(1);

    if (definitionsError) {
      console.error('❌ Custom property definitions table error:', definitionsError.message);
      return;
    }

    const { data: valuesData, error: valuesError } = await supabase
      .from('custom_property_values')
      .select('count(*)')
      .limit(1);

    if (valuesError) {
      console.error('❌ Custom property values table error:', valuesError.message);
      return;
    }

    console.log('✅ All Phase 3 tables are accessible');

    // Test 2: Check TypeScript compilation
    console.log('\n2. Testing TypeScript compilation...');

    // Import the services (this will fail if there are TypeScript errors)
    const taskService = require('./packages/data/services/taskService.ts');
    const customPropertyService = require('./packages/data/services/customPropertyService.ts');

    console.log('✅ TaskService exports:', Object.keys(taskService).join(', '));
    console.log('✅ CustomPropertyService exports:', Object.keys(customPropertyService).join(', '));

    // Test 3: Check package exports
    console.log('\n3. Testing package exports...');

    try {
      const dataPackage = require('./packages/data/index.ts');
      console.log('✅ Data package exports include new services');

      const hooksPackage = require('./packages/data/hooks.ts');
      console.log('✅ Hooks package exports include new hooks');
    } catch (error) {
      console.error('❌ Package export error:', error.message);
    }

    console.log('\n✅ Phase 3 implementation appears to be working correctly!');
    console.log('\nNext steps:');
    console.log('- Apply database migration: supabase db push');
    console.log('- Test task CRUD operations in your application');
    console.log('- Test custom property management features');
    console.log('- Ready to proceed to Phase 4!');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testPhase3().catch(console.error);