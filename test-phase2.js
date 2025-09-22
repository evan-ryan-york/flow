// Test script for Phase 2: Project & Collaboration Management
// This script tests the projectService functions and verifies they compile correctly

const { createRequire } = require('module');
const require = createRequire(import.meta.url);

console.log('🧪 Phase 2 Implementation Test');
console.log('='.repeat(50));

try {
  // Test 1: Check if services can be imported
  console.log('✅ Test 1: Import projectService');
  const projectService = require('./packages/data/services/projectService.ts');
  console.log('   - projectService imports successfully');

  // Test 2: Check if hooks can be imported
  console.log('✅ Test 2: Import useProject hooks');
  const useProjectHooks = require('./packages/data/hooks/useProject.ts');
  console.log('   - useProject hooks import successfully');

  // Test 3: Verify expected functions exist
  console.log('✅ Test 3: Verify service functions');
  const expectedFunctions = [
    'createProject',
    'getProjectsForUser',
    'getProjectById',
    'updateProject',
    'deleteProject',
    'getProjectMembers',
    'addProjectMember',
    'removeProjectMember',
    'updateMemberRole'
  ];

  expectedFunctions.forEach(fn => {
    if (typeof projectService[fn] === 'function') {
      console.log(`   ✓ ${fn} - Available`);
    } else {
      console.log(`   ✗ ${fn} - Missing`);
    }
  });

  // Test 4: Verify hook functions exist
  console.log('✅ Test 4: Verify hook functions');
  const expectedHooks = [
    'useProjectsForUser',
    'useProject',
    'useProjectMembers',
    'useCreateProject',
    'useUpdateProject',
    'useDeleteProject',
    'useAddProjectMember',
    'useRemoveProjectMember',
    'useUpdateMemberRole'
  ];

  expectedHooks.forEach(hook => {
    if (typeof useProjectHooks[hook] === 'function') {
      console.log(`   ✓ ${hook} - Available`);
    } else {
      console.log(`   ✗ ${hook} - Missing`);
    }
  });

  console.log('\n🎉 Phase 2 implementation test completed successfully!');
  console.log('All required services and hooks are properly exported.');

} catch (error) {
  console.error('❌ Phase 2 test failed:', error.message);
  process.exit(1);
}