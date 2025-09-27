import { z } from 'zod';
import { getSupabaseClient } from '../supabase';
import { ProfileSchema, type Profile } from '@perfect-task-app/models';

const supabase = getSupabaseClient();

export interface ProfileUpdates {
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  last_used_project_id?: string | null;
  visible_project_ids?: string[];
}

export const getProfile = async (userId: string): Promise<Profile> => {
  try {
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
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('first_name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch profiles: ${error.message}`);
    }

    // Filter out profiles without names and validate against Zod schema
    const validatedProfiles = data
      .filter(profile => profile.first_name || profile.last_name)
      .map(profile => ProfileSchema.parse(profile));

    return validatedProfiles;
  } catch (error) {
    console.error('ProfileService.getAllProfiles error:', error);
    throw error;
  }
};

export const getVisibleProjectIds = async (userId: string): Promise<string[]> => {
  try {
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