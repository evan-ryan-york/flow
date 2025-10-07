import { getSupabaseClient } from '../supabase';
import { ProjectSchema, ProjectUserSchema, type Project, type ProjectUser } from '@perfect-task-app/models';

const supabase = getSupabaseClient();

export interface CreateProjectData {
  name: string;
}

export interface UpdateProjectData {
  name?: string;
  color?: 'rose' | 'amber' | 'mint' | 'sky' | 'violet' | 'lime' | 'teal' | 'crimson';
}

export interface AddProjectMemberData {
  userId: string;
  role: 'admin' | 'member' | 'viewer';
}

// Extended project type with user role information
export interface ProjectWithRole extends Project {
  userRole?: 'owner' | 'admin' | 'member' | 'viewer';
}

export const createProject = async (data: CreateProjectData & { ownerId: string }): Promise<Project> => {
  try {
    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        owner_id: data.ownerId,
        name: data.name,
        is_general: false,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create project: ${error.message}`);
    }

    if (!newProject) {
      throw new Error('Failed to create project: No data returned');
    }

    // Validate the data against our Zod schema
    const validatedProject = ProjectSchema.parse(newProject);

    return validatedProject;
  } catch (error) {
    console.error('ProjectService.createProject error:', error);
    throw error;
  }
};

export const getProjectsForUser = async (userId: string): Promise<ProjectWithRole[]> => {
  try {
    // Get projects where user is owner OR member
    // We need to do this in two separate queries and merge the results

    // First, get projects where user is the owner
    const { data: ownedProjects, error: ownedError } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', userId);

    if (ownedError) {
      throw new Error(`Failed to fetch owned projects: ${ownedError.message}`);
    }


    // Second, get projects where user is a member
    const { data: memberProjects, error: memberError } = await supabase
      .from('projects')
      .select(`
        *,
        project_users!inner(role)
      `)
      .eq('project_users.user_id', userId)
      .neq('owner_id', userId); // Exclude owned projects to avoid duplicates

    if (memberError) {
      throw new Error(`Failed to fetch member projects: ${memberError.message}`);
    }

    // Combine and deduplicate results
    const allProjects = [
      ...(ownedProjects || []).map(project => ({ ...project, project_users: [] })),
      ...(memberProjects || [])
    ];

    // Sort the combined results
    const sortedProjects = allProjects.sort((a, b) => {
      // General projects first
      if (a.is_general && !b.is_general) return -1;
      if (!a.is_general && b.is_general) return 1;

      // Then by created_at
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    // Transform the data to include user role and validate
    const projectsWithRole: ProjectWithRole[] = sortedProjects.map((item: { owner_id: string; project_users?: Array<{ role: 'admin' | 'member' | 'viewer' }>; [key: string]: unknown }) => {
      // Validate the base project data
      const project = ProjectSchema.parse(item);

      // Determine user role
      let userRole: 'owner' | 'admin' | 'member' | 'viewer';
      if (project.owner_id === userId) {
        userRole = 'owner';
      } else {
        // User is a member, get their role from the join table
        userRole = (item.project_users && item.project_users.length > 0) ? item.project_users[0].role : 'member';
      }

      return {
        ...project,
        userRole,
      };
    });

    return projectsWithRole;
  } catch (error) {
    console.error('ProjectService.getProjectsForUser error:', error);
    throw error;
  }
};

export const getProjectById = async (projectId: string): Promise<Project> => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch project: ${error.message}`);
    }

    if (!data) {
      throw new Error('Project not found');
    }

    // Validate the data against our Zod schema
    const validatedProject = ProjectSchema.parse(data);

    return validatedProject;
  } catch (error) {
    console.error('ProjectService.getProjectById error:', error);
    throw error;
  }
};

export const updateProject = async (projectId: string, updates: UpdateProjectData): Promise<Project> => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update project: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to update project: No data returned');
    }

    // Validate the updated data against our Zod schema
    const validatedProject = ProjectSchema.parse(data);

    return validatedProject;
  } catch (error) {
    console.error('ProjectService.updateProject error:', error);
    throw error;
  }
};

export const deleteProject = async (projectId: string): Promise<void> => {
  try {
    // First check if this is a general project
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('is_general')
      .eq('id', projectId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch project: ${fetchError.message}`);
    }

    if (project?.is_general) {
      throw new Error('Cannot delete the General project');
    }

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) {
      throw new Error(`Failed to delete project: ${error.message}`);
    }
  } catch (error) {
    console.error('ProjectService.deleteProject error:', error);
    throw error;
  }
};

export const getProjectMembers = async (projectId: string): Promise<ProjectUser[]> => {
  try {
    const { data, error } = await supabase
      .from('project_users')
      .select('*')
      .eq('project_id', projectId);

    if (error) {
      throw new Error(`Failed to fetch project members: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    // Validate each member record against our Zod schema
    const validatedMembers = data.map((member) => ProjectUserSchema.parse(member));

    return validatedMembers;
  } catch (error) {
    console.error('ProjectService.getProjectMembers error:', error);
    throw error;
  }
};

export const addProjectMember = async (
  projectId: string,
  userId: string,
  role: 'admin' | 'member' | 'viewer' = 'member'
): Promise<ProjectUser> => {
  try {
    const { data, error } = await supabase
      .from('project_users')
      .insert({
        project_id: projectId,
        user_id: userId,
        role,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to add project member: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to add project member: No data returned');
    }

    // Validate the data against our Zod schema
    const validatedProjectUser = ProjectUserSchema.parse(data);

    return validatedProjectUser;
  } catch (error) {
    console.error('ProjectService.addProjectMember error:', error);
    throw error;
  }
};

export const removeProjectMember = async (projectId: string, userId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('project_users')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to remove project member: ${error.message}`);
    }
  } catch (error) {
    console.error('ProjectService.removeProjectMember error:', error);
    throw error;
  }
};

export const updateMemberRole = async (
  projectId: string,
  userId: string,
  newRole: 'admin' | 'member' | 'viewer'
): Promise<ProjectUser> => {
  try {
    const { data, error } = await supabase
      .from('project_users')
      .update({ role: newRole })
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update member role: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to update member role: No data returned');
    }

    // Validate the updated data against our Zod schema
    const validatedProjectUser = ProjectUserSchema.parse(data);

    return validatedProjectUser;
  } catch (error) {
    console.error('ProjectService.updateMemberRole error:', error);
    throw error;
  }
};

/**
 * Reassign tasks from one project to another (for project deletion)
 */
export const reassignProjectTasks = async (fromProjectId: string, toProjectId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('tasks')
      .update({ project_id: toProjectId })
      .eq('project_id', fromProjectId);

    if (error) {
      throw new Error(`Failed to reassign tasks: ${error.message}`);
    }
  } catch (error) {
    console.error('ProjectService.reassignProjectTasks error:', error);
    throw error;
  }
};

/**
 * Get the "General" project for a user
 */
export const getGeneralProject = async (userId: string): Promise<Project | null> => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', userId)
      .eq('is_general', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No general project found
      }
      throw new Error(`Failed to fetch general project: ${error.message}`);
    }

    const validatedProject = ProjectSchema.parse(data);
    return validatedProject;
  } catch (error) {
    console.error('ProjectService.getDefaultProject error:', error);
    throw error;
  }
};

/**
 * Search projects by name for autocomplete functionality
 */
export const searchProjects = async (userId: string, query: string): Promise<Project[]> => {
  try {
    if (!query || query.trim() === '') {
      return [];
    }

    const trimmedQuery = query.trim();

    // Get projects where user is owner OR member and name matches query
    // First, get owned projects that match
    const { data: ownedProjects, error: ownedError } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', userId)
      .ilike('name', `%${trimmedQuery}%`)
      .limit(10);

    if (ownedError) {
      throw new Error(`Failed to search owned projects: ${ownedError.message}`);
    }

    // Second, get member projects that match
    const { data: memberProjects, error: memberError } = await supabase
      .from('projects')
      .select(`
        *,
        project_users!inner(user_id)
      `)
      .eq('project_users.user_id', userId)
      .neq('owner_id', userId) // Exclude owned projects to avoid duplicates
      .ilike('name', `%${trimmedQuery}%`)
      .limit(10);

    if (memberError) {
      throw new Error(`Failed to search member projects: ${memberError.message}`);
    }

    // Combine and deduplicate results
    const allProjects = [
      ...(ownedProjects || []),
      ...(memberProjects || [])
    ];

    // Remove duplicates by id and sort by relevance
    const uniqueProjects = allProjects.filter((project, index, self) =>
      index === self.findIndex(p => p.id === project.id)
    );

    // Sort by exact matches first, then partial matches
    const sortedProjects = uniqueProjects.sort((a, b) => {
      const aExact = a.name.toLowerCase() === trimmedQuery.toLowerCase();
      const bExact = b.name.toLowerCase() === trimmedQuery.toLowerCase();

      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // Then by name alphabetically
      return a.name.localeCompare(b.name);
    });

    // Validate and return
    const validatedProjects = sortedProjects.map(project => ProjectSchema.parse(project));
    return validatedProjects.slice(0, 10); // Limit to 10 results
  } catch (error) {
    console.error('ProjectService.searchProjects error:', error);
    throw error;
  }
};