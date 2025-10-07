import { getSupabaseClient } from "../supabase";

const supabase = getSupabaseClient();
import {
  CustomPropertyDefinitionSchema,
  CustomPropertyDefinitionWithProjectsSchema,
  CustomPropertyValueSchema,
  CustomPropertyProjectAssignmentSchema,
  type CustomPropertyDefinition,
  type CustomPropertyDefinitionWithProjects,
  type CustomPropertyValue,
  type CustomPropertyProjectAssignment,
} from "@perfect-task-app/models";

export interface CreateDefinitionData {
  project_ids: string[]; // Changed to support multiple projects
  created_by?: string; // Made optional - will use auth.uid() if not provided
  name: string;
  type: "text" | "select" | "date" | "number";
  options?: string[];
  display_order?: number;
}

// Legacy interface for backward compatibility
export interface CreateDefinitionDataLegacy {
  project_id: string;
  created_by: string;
  name: string;
  type: "text" | "select" | "date" | "number";
  options?: string[];
  display_order?: number;
}

export interface UpdateDefinitionData {
  name?: string;
  type?: "text" | "select" | "date" | "number";
  options?: string[];
  display_order?: number;
}

export interface SetPropertyValueData {
  task_id: string;
  definition_id: string;
  value: string;
  user_id: string;
}

// Custom Property Definitions Functions

// Get all custom property definitions for a user across all their projects
export const getAllDefinitionsForUser = async (userId: string): Promise<CustomPropertyDefinitionWithProjects[]> => {
  try {
    // Get all definitions created by this user with their project assignments
    const { data, error } = await supabase
      .from("custom_property_definitions")
      .select(
        `
        id,
        created_by,
        name,
        type,
        options,
        display_order,
        created_at,
        updated_at,
        project_id,
        custom_property_project_assignments(project_id)
      `,
      )
      .eq("created_by", userId)
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch all property definitions for user: ${error.message}`);
    }

    // Transform data to include project_ids array
    const transformedData =
      data?.map((def: { id: string; created_by: string; name: string; type: string; options?: string[]; display_order?: number; created_at: string; updated_at: string; project_id?: string; custom_property_project_assignments?: { project_id: string }[] }) => {
        // Get project assignments from the junction table
        let project_ids =
          def.custom_property_project_assignments?.map((assignment: { project_id: string }) => assignment.project_id) || [];

        // Fallback to legacy project_id if no assignments exist (for backward compatibility)
        if (project_ids.length === 0 && def.project_id) {
          project_ids = [def.project_id];
        }

        return {
          id: def.id,
          created_by: def.created_by,
          name: def.name,
          type: def.type,
          options: def.options,
          display_order: def.display_order,
          created_at: def.created_at,
          updated_at: def.updated_at,
          project_ids,
        };
      }) || [];

    // Zod validation
    const validatedDefinitions = CustomPropertyDefinitionWithProjectsSchema.array().parse(transformedData);
    return validatedDefinitions;
  } catch (error) {
    console.error("CustomPropertyService.getAllDefinitionsForUser error:", error);
    throw error;
  }
};

// Legacy version - maintains backward compatibility until migration is applied
export const getDefinitionsForProject = async (projectId: string): Promise<CustomPropertyDefinition[]> => {
  try {
    const { data, error } = await supabase
      .from("custom_property_definitions")
      .select("*")
      .eq("project_id", projectId)
      .order("display_order", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch property definitions for project: ${error.message}`);
    }

    // Zod validation
    const validatedDefinitions = CustomPropertyDefinitionSchema.array().parse(data || []);
    return validatedDefinitions;
  } catch (error) {
    console.error("CustomPropertyService.getDefinitionsForProject error:", error);
    throw error;
  }
};

// New version with multi-project support - will be used after migration
export const getDefinitionsForProjectWithProjects = async (
  projectId: string,
): Promise<CustomPropertyDefinitionWithProjects[]> => {
  try {
    // Join with assignments table to get definitions for the project
    const { data, error } = await supabase
      .from("custom_property_definitions")
      .select(
        `
        id,
        created_by,
        name,
        type,
        options,
        display_order,
        created_at,
        updated_at,
        custom_property_project_assignments!inner(project_id)
      `,
      )
      .eq("custom_property_project_assignments.project_id", projectId)
      .order("display_order", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch property definitions for project: ${error.message}`);
    }

    // Transform data to include project_ids array
    const transformedData =
      data?.map((def: { id: string; created_by: string; name: string; type: string; options?: string[]; display_order?: number; created_at: string; updated_at: string }) => ({
        ...def,
        project_ids: [projectId], // For now, just include the requested project
      })) || [];

    // Zod validation
    const validatedDefinitions = CustomPropertyDefinitionWithProjectsSchema.array().parse(transformedData);
    return validatedDefinitions;
  } catch (error) {
    console.error("CustomPropertyService.getDefinitionsForProjectWithProjects error:", error);
    throw error;
  }
};

// Get all projects assigned to a custom property definition
export const getProjectsForDefinition = async (definitionId: string): Promise<CustomPropertyProjectAssignment[]> => {
  try {
    const { data, error } = await supabase
      .from("custom_property_project_assignments")
      .select("*")
      .eq("definition_id", definitionId);

    if (error) {
      throw new Error(`Failed to fetch projects for definition: ${error.message}`);
    }

    const validatedAssignments = CustomPropertyProjectAssignmentSchema.array().parse(data || []);
    return validatedAssignments;
  } catch (error) {
    console.error("CustomPropertyService.getProjectsForDefinition error:", error);
    throw error;
  }
};

export const createDefinition = async (
  definitionData: CreateDefinitionData,
): Promise<CustomPropertyDefinitionWithProjects> => {
  try {
    // First create the definition (without project_ids in the insert)
    const { project_ids, created_by: _created_by, ...definitionWithoutCreatedBy } = definitionData;
    const { data, error } = await supabase
      .from("custom_property_definitions")
      .insert({
        ...definitionWithoutCreatedBy,
        // Don't pass created_by - the database trigger will set it to auth.uid()
        project_id: project_ids[0], // Keep backward compatibility by using first project
        display_order: definitionData.display_order || 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create property definition: ${error.message}`);
    }

    // Insert project assignments
    const assignments = project_ids.map((projectId) => ({
      definition_id: data.id,
      project_id: projectId,
    }));

    const { error: assignmentError } = await supabase.from("custom_property_project_assignments").insert(assignments);

    if (assignmentError) {
      // Rollback: delete the created definition
      await supabase.from("custom_property_definitions").delete().eq("id", data.id);
      throw new Error(`Failed to create property assignments: ${assignmentError.message}`);
    }

    // Return the definition with project_ids
    const result = {
      ...data,
      project_ids: project_ids,
    };

    // Remove the legacy project_id from the result for the new type
    const { project_id: _project_id, ...resultWithoutProjectId } = result;

    // Zod validation
    const validatedDefinition = CustomPropertyDefinitionWithProjectsSchema.parse(resultWithoutProjectId);
    return validatedDefinition;
  } catch (error) {
    console.error("CustomPropertyService.createDefinition error:", error);
    throw error;
  }
};

// Update project assignments for a custom property definition
export const updateDefinitionProjects = async (definitionId: string, projectIds: string[]): Promise<void> => {
  try {
    // First, delete existing assignments
    const { error: deleteError } = await supabase
      .from("custom_property_project_assignments")
      .delete()
      .eq("definition_id", definitionId);

    if (deleteError) {
      throw new Error(`Failed to delete existing project assignments: ${deleteError.message}`);
    }

    // Then insert new assignments
    if (projectIds.length > 0) {
      const assignments = projectIds.map((projectId) => ({
        definition_id: definitionId,
        project_id: projectId,
      }));

      const { error: insertError } = await supabase.from("custom_property_project_assignments").insert(assignments);

      if (insertError) {
        throw new Error(`Failed to create new project assignments: ${insertError.message}`);
      }
    }
  } catch (error) {
    console.error("CustomPropertyService.updateDefinitionProjects error:", error);
    throw error;
  }
};

export const updateDefinition = async (
  definitionId: string,
  updates: UpdateDefinitionData & { project_ids?: string[] },
): Promise<CustomPropertyDefinitionWithProjects> => {
  try {
    // Separate project_ids from other updates
    const { project_ids, ...definitionUpdates } = updates;

    const { data, error } = await supabase
      .from("custom_property_definitions")
      .update({
        ...definitionUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", definitionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update property definition: ${error.message}`);
    }

    // Update project assignments if provided
    if (project_ids) {
      await updateDefinitionProjects(definitionId, project_ids);
    }

    // Get current project assignments to return with the result
    const currentProjectIds = project_ids || [];
    if (!project_ids) {
      const assignments = await getProjectsForDefinition(definitionId);
      currentProjectIds.push(...assignments.map((a) => a.project_id));
    }

    // Return the definition with project_ids
    const result = {
      ...data,
      project_ids: currentProjectIds,
    };

    // Remove the legacy project_id from the result for the new type
    const { project_id: _project_id2, ...resultWithoutProjectId } = result;

    // Zod validation
    const validatedDefinition = CustomPropertyDefinitionWithProjectsSchema.parse(resultWithoutProjectId);
    return validatedDefinition;
  } catch (error) {
    console.error("CustomPropertyService.updateDefinition error:", error);
    throw error;
  }
};

export const deleteDefinition = async (definitionId: string): Promise<void> => {
  try {
    const { error } = await supabase.from("custom_property_definitions").delete().eq("id", definitionId);

    if (error) {
      throw new Error(`Failed to delete property definition: ${error.message}`);
    }
  } catch (error) {
    console.error("CustomPropertyService.deleteDefinition error:", error);
    throw error;
  }
};

// Custom Property Values Functions

export const getValuesForTask = async (taskId: string): Promise<CustomPropertyValue[]> => {
  try {
    const { data, error } = await supabase.from("custom_property_values").select("*").eq("task_id", taskId);

    if (error) {
      throw new Error(`Failed to fetch property values for task: ${error.message}`);
    }

    // Zod validation
    const validatedValues = CustomPropertyValueSchema.array().parse(data);
    return validatedValues;
  } catch (error) {
    console.error("CustomPropertyService.getValuesForTask error:", error);
    throw error;
  }
};

export const getValuesForTasks = async (taskIds: string[]): Promise<CustomPropertyValue[]> => {
  try {
    if (taskIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from("custom_property_values")
      .select("*")
      .in("task_id", taskIds);

    if (error) {
      throw new Error(`Failed to fetch property values for tasks: ${error.message}`);
    }

    // Zod validation
    const validatedValues = CustomPropertyValueSchema.array().parse(data || []);
    return validatedValues;
  } catch (error) {
    console.error("CustomPropertyService.getValuesForTasks error:", error);
    throw error;
  }
};

export const setPropertyValue = async (data: SetPropertyValueData): Promise<CustomPropertyValue> => {
  try {
    console.log("Setting property value:", data);
    // This performs an "upsert" - insert if doesn't exist, update if it does
    const timestamp = new Date().toISOString();
    const { data: result, error } = await supabase
      .from("custom_property_values")
      .upsert(
        {
          task_id: data.task_id,
          definition_id: data.definition_id,
          value: data.value,
          created_by: data.user_id,
          updated_by: data.user_id,
          created_at: timestamp,
          updated_at: timestamp,
        },
        {
          onConflict: "task_id,definition_id",
        },
      )
      .select()
      .single();

    if (error) {
      console.error("Database error setting property value:", error);
      throw new Error(`Failed to set property value: ${error.message}`);
    }

    console.log("Property value set successfully:", result);

    // Zod validation
    const validatedValue = CustomPropertyValueSchema.parse(result);
    return validatedValue;
  } catch (error) {
    console.error("CustomPropertyService.setPropertyValue error:", error);
    throw error;
  }
};

export const deletePropertyValue = async (taskId: string, definitionId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from("custom_property_values")
      .delete()
      .eq("task_id", taskId)
      .eq("definition_id", definitionId);

    if (error) {
      throw new Error(`Failed to delete property value: ${error.message}`);
    }
  } catch (error) {
    console.error("CustomPropertyService.deletePropertyValue error:", error);
    throw error;
  }
};
