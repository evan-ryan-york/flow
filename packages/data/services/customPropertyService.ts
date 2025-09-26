import { getSupabaseClient } from '../supabase';

const supabase = getSupabaseClient();
import {
  CustomPropertyDefinitionSchema,
  CustomPropertyValueSchema,
  type CustomPropertyDefinition,
  type CustomPropertyValue
} from '@perfect-task-app/models';

export interface CreateDefinitionData {
  project_id: string;
  created_by: string;
  name: string;
  type: 'text' | 'select' | 'date' | 'number';
  options?: any;
  display_order?: number;
}

export interface UpdateDefinitionData {
  name?: string;
  type?: 'text' | 'select' | 'date' | 'number';
  options?: any;
  display_order?: number;
}

export interface SetPropertyValueData {
  task_id: string;
  definition_id: string;
  value: string;
  user_id: string;
}

// Custom Property Definitions Functions

export const getDefinitionsForProject = async (projectId: string): Promise<CustomPropertyDefinition[]> => {
  try {
    const { data, error } = await supabase
      .from('custom_property_definitions')
      .select('*')
      .eq('project_id', projectId)
      .order('display_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch property definitions for project: ${error.message}`);
    }

    // Zod validation
    const validatedDefinitions = CustomPropertyDefinitionSchema.array().parse(data);
    return validatedDefinitions;
  } catch (error) {
    console.error('CustomPropertyService.getDefinitionsForProject error:', error);
    throw error;
  }
};

export const createDefinition = async (definitionData: CreateDefinitionData): Promise<CustomPropertyDefinition> => {
  try {
    const { data, error } = await supabase
      .from('custom_property_definitions')
      .insert({
        ...definitionData,
        display_order: definitionData.display_order || 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create property definition: ${error.message}`);
    }

    // Zod validation
    const validatedDefinition = CustomPropertyDefinitionSchema.parse(data);
    return validatedDefinition;
  } catch (error) {
    console.error('CustomPropertyService.createDefinition error:', error);
    throw error;
  }
};

export const updateDefinition = async (definitionId: string, updates: UpdateDefinitionData): Promise<CustomPropertyDefinition> => {
  try {
    const { data, error } = await supabase
      .from('custom_property_definitions')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', definitionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update property definition: ${error.message}`);
    }

    // Zod validation
    const validatedDefinition = CustomPropertyDefinitionSchema.parse(data);
    return validatedDefinition;
  } catch (error) {
    console.error('CustomPropertyService.updateDefinition error:', error);
    throw error;
  }
};

export const deleteDefinition = async (definitionId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('custom_property_definitions')
      .delete()
      .eq('id', definitionId);

    if (error) {
      throw new Error(`Failed to delete property definition: ${error.message}`);
    }
  } catch (error) {
    console.error('CustomPropertyService.deleteDefinition error:', error);
    throw error;
  }
};

// Custom Property Values Functions

export const getValuesForTask = async (taskId: string): Promise<CustomPropertyValue[]> => {
  try {
    const { data, error } = await supabase
      .from('custom_property_values')
      .select('*')
      .eq('task_id', taskId);

    if (error) {
      throw new Error(`Failed to fetch property values for task: ${error.message}`);
    }

    // Zod validation
    const validatedValues = CustomPropertyValueSchema.array().parse(data);
    return validatedValues;
  } catch (error) {
    console.error('CustomPropertyService.getValuesForTask error:', error);
    throw error;
  }
};

export const setPropertyValue = async (data: SetPropertyValueData): Promise<CustomPropertyValue> => {
  try {
    // This performs an "upsert" - insert if doesn't exist, update if it does
    const { data: result, error } = await supabase
      .from('custom_property_values')
      .upsert({
        task_id: data.task_id,
        definition_id: data.definition_id,
        value: data.value,
        created_by: data.user_id,
        updated_by: data.user_id,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'task_id,definition_id',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to set property value: ${error.message}`);
    }

    // Zod validation
    const validatedValue = CustomPropertyValueSchema.parse(result);
    return validatedValue;
  } catch (error) {
    console.error('CustomPropertyService.setPropertyValue error:', error);
    throw error;
  }
};

export const deletePropertyValue = async (taskId: string, definitionId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('custom_property_values')
      .delete()
      .eq('task_id', taskId)
      .eq('definition_id', definitionId);

    if (error) {
      throw new Error(`Failed to delete property value: ${error.message}`);
    }
  } catch (error) {
    console.error('CustomPropertyService.deletePropertyValue error:', error);
    throw error;
  }
};