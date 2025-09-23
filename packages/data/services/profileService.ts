import { supabase } from '../supabase';
import { ProfileSchema, type Profile } from '@perfect-task-app/models';

export interface ProfileUpdates {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  avatar_url?: string;
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

export const updateProfile = async (updates: { firstName: string }): Promise<Profile> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        first_name: updates.firstName,
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