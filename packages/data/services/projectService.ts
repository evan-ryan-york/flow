import { getSupabaseClient } from '../supabase';
import { ProjectSchema, ProjectUserSchema, type Project, type ProjectUser } from '@perfect-task-app/models';

const supabase = getSupabaseClient();

export interface CreateProjectData {
  name: string;
}

export interface UpdateProjectData {
  name?: string;
}

export interface AddProjectMemberData {
  userId: string;
  role: 'admin' | 'member' | 'viewer';
}

// Extended project type with user role information
export interface ProjectWithRole extends Project {
  userRole?: 'owner' | 'admin' | 'member' | 'viewer';
}

export const createProject = async (ownerId: string, name: string): Promise<Project> => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .insert({
        owner_id: ownerId,
        name,
        is_general: false,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create project: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to create project: No data returned');
    }

    // Validate the data against our Zod schema
    const validatedProject = ProjectSchema.parse(data);

    return validatedProject;
  } catch (error) {
    console.error('ProjectService.createProject error:', error);
    throw error;
  }
};

export const getProjectsForUser = async (userId: string): Promise<ProjectWithRole[]> => {
  try {
    // This is the most complex query - joins projects and project_users
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        project_users!inner(role)
      `)
      .or(`owner_id.eq.${userId},project_users.user_id.eq.${userId}`);

    if (error) {
      throw new Error(`Failed to fetch projects for user: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    // Transform the data to include user role and validate
    const projectsWithRole: ProjectWithRole[] = data.map((item: any) => {
      // Validate the base project data
      const project = ProjectSchema.parse({
        id: item.id,
        owner_id: item.owner_id,
        name: item.name,
        is_general: item.is_general,
        created_at: item.created_at,
        updated_at: item.updated_at,
      });

      // Determine user role
      let userRole: 'owner' | 'admin' | 'member' | 'viewer';
      if (project.owner_id === userId) {
        userRole = 'owner';
      } else {
        // User is a member, get their role from the join table
        userRole = item.project_users[0]?.role || 'member';
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