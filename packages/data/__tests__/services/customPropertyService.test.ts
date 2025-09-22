import { supabase } from '../../supabase';
import {
  getDefinitionsForProject,
  createDefinition,
  updateDefinition,
  deleteDefinition,
  getValuesForTask,
  setPropertyValue,
  deletePropertyValue,
  type CreateDefinitionData
} from '../../services/customPropertyService';
import { createTask } from '../../services/taskService';
import { CustomPropertyDefinitionSchema, CustomPropertyValueSchema } from '@perfect-task-app/models';

// Test users and data
let testUserA: any;
let testUserB: any;
let testProjectA: any;
let testProjectB: any;
let testTaskA: any;

describe('customPropertyService Integration Tests', () => {
  beforeEach(async () => {
    // Create test users
    const { data: userAAuth } = await supabase.auth.signUp({
      email: 'testusera@example.com',
      password: 'testpassword123',
    });

    const { data: userBAuth } = await supabase.auth.signUp({
      email: 'testuserb@example.com',
      password: 'testpassword123',
    });

    testUserA = userAAuth.user;
    testUserB = userBAuth.user;

    // Authenticate as User A and get their project
    await supabase.auth.signInWithPassword({
      email: 'testusera@example.com',
      password: 'testpassword123',
    });

    const { data: projectsA } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', testUserA.id)
      .eq('is_general', true)
      .single();

    testProjectA = projectsA;

    // Create a test task for property value testing
    testTaskA = await createTask({
      project_id: testProjectA.id,
      name: 'Test Task for Properties',
    });

    // Authenticate as User B and get their project
    await supabase.auth.signInWithPassword({
      email: 'testuserb@example.com',
      password: 'testpassword123',
    });

    const { data: projectsB } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', testUserB.id)
      .eq('is_general', true)
      .single();

    testProjectB = projectsB;
  });

  afterEach(async () => {
    await supabase.auth.signOut();
  });

  describe('Custom Property Definitions CRUD', () => {
    beforeEach(async () => {
      // Authenticate as User A for these tests
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });
    });

    it('should create a property definition successfully', async () => {
      const definitionData: CreateDefinitionData = {
        project_id: testProjectA.id,
        name: 'Priority',
        type: 'select',
        options: ['Low', 'Medium', 'High'],
        display_order: 1,
      };

      const result = await createDefinition(definitionData);

      expect(result).toBeDefined();
      expect(result.name).toBe('Priority');
      expect(result.type).toBe('select');
      expect(result.project_id).toBe(testProjectA.id);
      expect(result.created_by).toBe(testUserA.id);
      expect(result.display_order).toBe(1);

      // Verify Zod validation passed
      expect(() => CustomPropertyDefinitionSchema.parse(result)).not.toThrow();
    });

    it('should fetch definitions for a project', async () => {
      // Create test definitions
      const definition1: CreateDefinitionData = {
        project_id: testProjectA.id,
        name: 'Environment',
        type: 'select',
        options: ['QA', 'Prod', 'Staging'],
        display_order: 1,
      };

      const definition2: CreateDefinitionData = {
        project_id: testProjectA.id,
        name: 'Story Points',
        type: 'number',
        display_order: 2,
      };

      const created1 = await createDefinition(definition1);
      const created2 = await createDefinition(definition2);

      // Fetch definitions for the project
      const definitions = await getDefinitionsForProject(testProjectA.id);

      expect(Array.isArray(definitions)).toBe(true);
      expect(definitions.length).toBeGreaterThanOrEqual(2);

      // Find our created definitions
      const foundDef1 = definitions.find(def => def.id === created1.id);
      const foundDef2 = definitions.find(def => def.id === created2.id);

      expect(foundDef1).toBeDefined();
      expect(foundDef2).toBeDefined();

      // Verify ordering (should be ordered by display_order)
      const def1Index = definitions.findIndex(def => def.id === created1.id);
      const def2Index = definitions.findIndex(def => def.id === created2.id);
      expect(def1Index).toBeLessThan(def2Index);

      // Verify all definitions belong to the project and pass Zod validation
      definitions.forEach(def => {
        expect(def.project_id).toBe(testProjectA.id);
        expect(() => CustomPropertyDefinitionSchema.parse(def)).not.toThrow();
      });
    });

    it('should update a property definition successfully', async () => {
      // Create a test definition
      const definitionData: CreateDefinitionData = {
        project_id: testProjectA.id,
        name: 'Status',
        type: 'select',
        options: ['Open', 'Closed'],
      };

      const createdDefinition = await createDefinition(definitionData);

      // Update the definition
      const updatedDefinition = await updateDefinition(createdDefinition.id, {
        name: 'Bug Status',
        options: ['Open', 'In Progress', 'Closed', 'Won\'t Fix'],
        display_order: 5,
      });

      expect(updatedDefinition.id).toBe(createdDefinition.id);
      expect(updatedDefinition.name).toBe('Bug Status');
      expect(updatedDefinition.options).toEqual(['Open', 'In Progress', 'Closed', 'Won\'t Fix']);
      expect(updatedDefinition.display_order).toBe(5);
      expect(() => CustomPropertyDefinitionSchema.parse(updatedDefinition)).not.toThrow();
    });

    it('should delete a property definition successfully', async () => {
      // Create a test definition
      const definitionData: CreateDefinitionData = {
        project_id: testProjectA.id,
        name: 'Temporary Field',
        type: 'text',
      };

      const createdDefinition = await createDefinition(definitionData);

      // Verify definition exists
      let definitions = await getDefinitionsForProject(testProjectA.id);
      expect(definitions.find(def => def.id === createdDefinition.id)).toBeDefined();

      // Delete the definition
      await deleteDefinition(createdDefinition.id);

      // Verify definition is deleted
      definitions = await getDefinitionsForProject(testProjectA.id);
      expect(definitions.find(def => def.id === createdDefinition.id)).toBeUndefined();
    });
  });

  describe('Custom Property Values CRUD', () => {
    let testDefinition: any;

    beforeEach(async () => {
      // Authenticate as User A
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });

      // Create a test definition for value tests
      const definitionData: CreateDefinitionData = {
        project_id: testProjectA.id,
        name: 'Test Property',
        type: 'select',
        options: ['Option1', 'Option2', 'Option3'],
      };

      testDefinition = await createDefinition(definitionData);
    });

    it('should set property value successfully (upsert)', async () => {
      // Set a property value
      const result = await setPropertyValue(
        testTaskA.id,
        testDefinition.id,
        'Option1'
      );

      expect(result).toBeDefined();
      expect(result.task_id).toBe(testTaskA.id);
      expect(result.definition_id).toBe(testDefinition.id);
      expect(result.value).toBe('Option1');
      expect(result.created_by).toBe(testUserA.id);

      // Verify Zod validation passed
      expect(() => CustomPropertyValueSchema.parse(result)).not.toThrow();
    });

    it('should update existing property value (upsert)', async () => {
      // Set initial value
      await setPropertyValue(testTaskA.id, testDefinition.id, 'Option1');

      // Update value (should upsert)
      const result = await setPropertyValue(
        testTaskA.id,
        testDefinition.id,
        'Option2'
      );

      expect(result.value).toBe('Option2');
      expect(result.updated_by).toBe(testUserA.id);

      // Verify only one value exists for this task/definition combo
      const values = await getValuesForTask(testTaskA.id);
      const matchingValues = values.filter(
        val => val.definition_id === testDefinition.id
      );
      expect(matchingValues).toHaveLength(1);
      expect(matchingValues[0].value).toBe('Option2');
    });

    it('should fetch property values for a task', async () => {
      // Create another definition
      const definition2 = await createDefinition({
        project_id: testProjectA.id,
        name: 'Second Property',
        type: 'text',
      });

      // Set values for both definitions
      await setPropertyValue(testTaskA.id, testDefinition.id, 'Option1');
      await setPropertyValue(testTaskA.id, definition2.id, 'Text Value');

      // Fetch values for the task
      const values = await getValuesForTask(testTaskA.id);

      expect(Array.isArray(values)).toBe(true);
      expect(values.length).toBe(2);

      // Verify both values are present
      const value1 = values.find(val => val.definition_id === testDefinition.id);
      const value2 = values.find(val => val.definition_id === definition2.id);

      expect(value1).toBeDefined();
      expect(value1?.value).toBe('Option1');
      expect(value2).toBeDefined();
      expect(value2?.value).toBe('Text Value');

      // Verify all values belong to the task and pass Zod validation
      values.forEach(val => {
        expect(val.task_id).toBe(testTaskA.id);
        expect(() => CustomPropertyValueSchema.parse(val)).not.toThrow();
      });
    });

    it('should delete property value successfully', async () => {
      // Set a property value
      await setPropertyValue(testTaskA.id, testDefinition.id, 'Option1');

      // Verify value exists
      let values = await getValuesForTask(testTaskA.id);
      expect(values.find(val => val.definition_id === testDefinition.id)).toBeDefined();

      // Delete the property value
      await deletePropertyValue(testTaskA.id, testDefinition.id);

      // Verify value is deleted
      values = await getValuesForTask(testTaskA.id);
      expect(values.find(val => val.definition_id === testDefinition.id)).toBeUndefined();
    });
  });

  describe('Row Level Security (RLS) Tests', () => {
    it('should only allow users to access definitions in their own projects', async () => {
      // As User A, create a definition in their project
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });

      const definitionA = await createDefinition({
        project_id: testProjectA.id,
        name: 'User A Property',
        type: 'text',
      });

      // Switch to User B
      await supabase.auth.signInWithPassword({
        email: 'testuserb@example.com',
        password: 'testpassword123',
      });

      // User B should not see User A's definitions
      const definitionsForUserAProject = await getDefinitionsForProject(testProjectA.id);
      expect(definitionsForUserAProject).toEqual([]);

      // User B should see their own project (even if empty)
      const definitionsForUserBProject = await getDefinitionsForProject(testProjectB.id);
      expect(Array.isArray(definitionsForUserBProject)).toBe(true);
    });

    it('should not allow users to update definitions in projects they dont own', async () => {
      // As User A, create a definition
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });

      const definition = await createDefinition({
        project_id: testProjectA.id,
        name: 'Protected Property',
        type: 'text',
      });

      // Switch to User B
      await supabase.auth.signInWithPassword({
        email: 'testuserb@example.com',
        password: 'testpassword123',
      });

      // User B should not be able to update User A's definition
      await expect(updateDefinition(definition.id, { name: 'Hacked!' }))
        .rejects
        .toThrow();
    });

    it('should not allow users to set property values on tasks in projects they dont own', async () => {
      // As User A, create a definition and task
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });

      const definition = await createDefinition({
        project_id: testProjectA.id,
        name: 'Protected Property',
        type: 'text',
      });

      // Switch to User B
      await supabase.auth.signInWithPassword({
        email: 'testuserb@example.com',
        password: 'testpassword123',
      });

      // User B should not be able to set property values on User A's task
      await expect(setPropertyValue(testTaskA.id, definition.id, 'Hacked Value'))
        .rejects
        .toThrow();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });
    });

    it('should handle empty definition lists gracefully', async () => {
      // Create a new project for this test
      const { data: emptyProject } = await supabase
        .from('projects')
        .insert({
          owner_id: testUserA.id,
          name: 'Empty Property Project',
        })
        .select()
        .single();

      const definitions = await getDefinitionsForProject(emptyProject.id);

      expect(Array.isArray(definitions)).toBe(true);
      expect(definitions.length).toBe(0);
    });

    it('should handle empty value lists gracefully', async () => {
      // Create a task with no property values set
      const taskWithNoValues = await createTask({
        project_id: testProjectA.id,
        name: 'Task with No Properties',
      });

      const values = await getValuesForTask(taskWithNoValues.id);

      expect(Array.isArray(values)).toBe(true);
      expect(values.length).toBe(0);
    });

    it('should require authentication for all operations', async () => {
      // Sign out to test unauthenticated access
      await supabase.auth.signOut();

      const definitionData: CreateDefinitionData = {
        project_id: testProjectA.id,
        name: 'Unauthorized Property',
        type: 'text',
      };

      await expect(createDefinition(definitionData))
        .rejects
        .toThrow('User must be authenticated');

      await expect(setPropertyValue('task-id', 'def-id', 'value'))
        .rejects
        .toThrow('User must be authenticated');
    });
  });

  describe('Data Shape Validation', () => {
    beforeEach(async () => {
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });
    });

    it('should validate definition data against Zod schema', async () => {
      const definitionData: CreateDefinitionData = {
        project_id: testProjectA.id,
        name: 'Schema Test Property',
        type: 'select',
        options: ['A', 'B', 'C'],
        display_order: 10,
      };

      const result = await createDefinition(definitionData);

      // This should not throw because the service validates with Zod
      expect(() => CustomPropertyDefinitionSchema.parse(result)).not.toThrow();

      // Verify all expected fields are present and correctly typed
      expect(typeof result.id).toBe('string');
      expect(typeof result.project_id).toBe('string');
      expect(typeof result.created_by).toBe('string');
      expect(typeof result.name).toBe('string');
      expect(typeof result.type).toBe('string');
      expect(typeof result.display_order).toBe('number');
    });

    it('should validate property value data against Zod schema', async () => {
      // Create a test definition first
      const definition = await createDefinition({
        project_id: testProjectA.id,
        name: 'Value Schema Test',
        type: 'text',
      });

      const result = await setPropertyValue(testTaskA.id, definition.id, 'Test Value');

      // This should not throw because the service validates with Zod
      expect(() => CustomPropertyValueSchema.parse(result)).not.toThrow();

      // Verify all expected fields are present and correctly typed
      expect(typeof result.id).toBe('string');
      expect(typeof result.task_id).toBe('string');
      expect(typeof result.definition_id).toBe('string');
      expect(typeof result.value).toBe('string');
      expect(typeof result.created_by).toBe('string');
    });
  });
});