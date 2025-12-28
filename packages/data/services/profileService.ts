import { z } from 'zod';
import { getSupabaseClient } from '../supabase';
import { ProfileSchema, type Profile } from '@flow-app/models';

export interface ProfileUpdates {
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  last_used_project_id?: string | null;
  visible_project_ids?: string[];
}

export const getProfile = async (userId: string): Promise<Profile> => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch profile: ${error.message}`);
    }

    if (!data) {
      throw new Error('Profile not found');
    }

    // Validate the data against our Zod schema
    const validatedProfile = ProfileSchema.parse(data);

    return validatedProfile;
  } catch (error) {
    console.error('ProfileService.getProfile error:', error);
    throw error;
  }
};

export const updateProfile = async (updates: ProfileUpdates): Promise<Profile> => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', (await supabase.auth.getUser()).data.user?.id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update profile: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to update profile: No data returned');
    }

    // Validate the updated data against our Zod schema
    const validatedProfile = ProfileSchema.parse(data);

    return validatedProfile;
  } catch (error) {
    console.error('ProfileService.updateProfile error:', error);
    throw error;
  }
};

export const getCurrentProfile = async (): Promise<Profile> => {
  try {
    const supabase = getSupabaseClient();
    // Get the current user first
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) {
      throw new Error(`Failed to get current user: ${userError.message}`);
    }

    if (!user) {
      throw new Error('No authenticated user found');
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch current profile: ${error.message}`);
    }

    if (!data) {
      throw new Error('Current profile not found');
    }

    // Validate the data against our Zod schema
    const validatedProfile = ProfileSchema.parse(data);

    return validatedProfile;
  } catch (error) {
    console.error('ProfileService.getCurrentProfile error:', error);
    throw error;
  }
};

export const updateLastUsedProject = async (projectId: string, userId?: string): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    let currentUserId = userId;

    // If no user ID provided, try to get from auth
    if (!currentUserId) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(`Failed to get current user: ${userError.message}`);
      }

      if (!user) {
        throw new Error('No authenticated user found');
      }

      currentUserId = user.id;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        last_used_project_id: projectId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentUserId);

    if (error) {
      throw new Error(`Failed to update last used project: ${error.message}`);
    }
  } catch (error) {
    console.error('ProfileService.updateLastUsedProject error:', error);
    throw error;
  }
};

export const getLastUsedProject = async (userId?: string): Promise<string | null> => {
  try {
    const supabase = getSupabaseClient();
    let currentUserId = userId;

    // If no user ID provided, try to get from auth
    if (!currentUserId) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(`Failed to get current user: ${userError.message}`);
      }

      if (!user) {
        throw new Error('No authenticated user found');
      }

      currentUserId = user.id;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('last_used_project_id')
      .eq('id', currentUserId)
      .single();

    if (error) {
      throw new Error(`Failed to get last used project: ${error.message}`);
    }

    return data?.last_used_project_id || null;
  } catch (error) {
    console.error('ProfileService.getLastUsedProject error:', error);
    throw error;
  }
};

export const getAllProfiles = async (): Promise<Profile[]> => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('first_name', { ascending: true, nullsFirst: false });

    if (error) {
      throw new Error(`Failed to fetch profiles: ${error.message}`);
    }

    // Validate all profiles against Zod schema (no filtering)
    const validatedProfiles = (data || []).map(profile => ProfileSchema.parse(profile));

    return validatedProfiles;
  } catch (error) {
    console.error('ProfileService.getAllProfiles error:', error);
    throw error;
  }
};

/**
 * Get profiles of users who share projects with the current user.
 * This includes:
 * - The current user
 * - Owners of projects where the current user is a member
 * - Members of projects where the current user is the owner or a member
 */
export const getConnectedProfiles = async (): Promise<Profile[]> => {
  try {
    const supabase = getSupabaseClient();

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      throw new Error(`Failed to get current user: ${userError.message}`);
    }
    if (!user) {
      throw new Error('No authenticated user found');
    }

    const currentUserId = user.id;

    // Step 1: Get all project IDs where current user is owner
    const { data: ownedProjects, error: ownedError } = await supabase
      .from('projects')
      .select('id')
      .eq('owner_id', currentUserId);

    if (ownedError) {
      throw new Error(`Failed to fetch owned projects: ${ownedError.message}`);
    }

    // Step 2: Get all project IDs where current user is a member
    const { data: memberProjects, error: memberError } = await supabase
      .from('project_users')
      .select('project_id')
      .eq('user_id', currentUserId);

    if (memberError) {
      throw new Error(`Failed to fetch member projects: ${memberError.message}`);
    }

    // Combine all project IDs
    const allProjectIds = [
      ...(ownedProjects || []).map(p => p.id),
      ...(memberProjects || []).map(p => p.project_id),
    ];

    // If user has no projects, just return their own profile
    if (allProjectIds.length === 0) {
      const { data: ownProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUserId)
        .single();

      if (profileError) {
        throw new Error(`Failed to fetch own profile: ${profileError.message}`);
      }

      return ownProfile ? [ProfileSchema.parse(ownProfile)] : [];
    }

    // Step 3: Get owners of these projects
    const { data: projectOwners, error: ownersError } = await supabase
      .from('projects')
      .select('owner_id')
      .in('id', allProjectIds);

    if (ownersError) {
      throw new Error(`Failed to fetch project owners: ${ownersError.message}`);
    }

    // Step 4: Get members of these projects
    const { data: projectMembers, error: membersError } = await supabase
      .from('project_users')
      .select('user_id')
      .in('project_id', allProjectIds);

    if (membersError) {
      throw new Error(`Failed to fetch project members: ${membersError.message}`);
    }

    // Combine and deduplicate all user IDs
    const allUserIds = new Set<string>([
      currentUserId,
      ...(projectOwners || []).map(p => p.owner_id),
      ...(projectMembers || []).map(p => p.user_id),
    ]);

    // Step 5: Get profiles for all connected users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', Array.from(allUserIds))
      .order('first_name', { ascending: true, nullsFirst: false });

    if (profilesError) {
      throw new Error(`Failed to fetch connected profiles: ${profilesError.message}`);
    }

    // Validate all profiles against Zod schema
    const validatedProfiles = (profiles || []).map(profile => ProfileSchema.parse(profile));

    return validatedProfiles;
  } catch (error) {
    console.error('ProfileService.getConnectedProfiles error:', error);
    throw error;
  }
};

export const getVisibleProjectIds = async (userId: string): Promise<string[]> => {
  try {
    const supabase = getSupabaseClient();
    // 1. Supabase API call
    const { data, error } = await supabase
      .from('profiles')
      .select('visible_project_ids')
      .eq('id', userId)
      .single();

    // 2. Error handling
    if (error) {
      if (error.code === 'PGRST116') {
        return []; // No profile found - return empty array (show all projects)
      }
      throw new Error(`Failed to get visible project IDs: ${error.message}`);
    }

    // 3. Zod validation (validate the specific field)
    const validatedIds = z.array(z.string().uuid()).optional().parse(data?.visible_project_ids);

    // 4. Return type-safe data
    return validatedIds || [];
  } catch (error) {
    // 5. Comprehensive error logging
    console.error('ProfileService.getVisibleProjectIds error:', error);
    throw error;
  }
};

export const updateVisibleProjectIds = async (projectIds: string[], userId?: string): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    let currentUserId = userId;

    // If no user ID provided, try to get from auth
    if (!currentUserId) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(`Failed to get current user: ${userError.message}`);
      }

      if (!user) {
        throw new Error('No authenticated user found');
      }

      currentUserId = user.id;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        visible_project_ids: projectIds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentUserId);

    if (error) {
      throw new Error(`Failed to update visible project IDs: ${error.message}`);
    }
  } catch (error) {
    console.error('ProfileService.updateVisibleProjectIds error:', error);
    throw error;
  }
};