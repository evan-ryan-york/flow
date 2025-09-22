import { supabase } from '../supabase';
import { ViewSchema, type View } from '@perfect-task-app/models';

export interface CreateViewData {
  name: string;
  type: 'list' | 'kanban';
  config: {
    projectIds: string[];
    groupBy?: string;
    sortBy?: string;
    visibleProperties?: string[];
  };
}

export interface UpdateViewData {
  name?: string;
  type?: 'list' | 'kanban';
  config?: {
    projectIds?: string[];
    groupBy?: string;
    sortBy?: string;
    visibleProperties?: string[];
  };
}

export const getViewsForUser = async (userId: string): Promise<View[]> => {
  try {
    const { data, error } = await supabase
      .from('views')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch views for user: ${error.message}`);
    }

    // Zod validation happens here - ensuring type safety
    const validatedViews = ViewSchema.array().parse(data);
    return validatedViews;
  } catch (error) {
    console.error('ViewService.getViewsForUser error:', error);
    throw error;
  }
};

export const createView = async (viewData: CreateViewData): Promise<View> => {
  try {
    const { data: user } = await supabase.auth.getUser();

    if (!user.user) {
      throw new Error('User must be authenticated to create views');
    }

    const { data, error } = await supabase
      .from('views')
      .insert({
        ...viewData,
        user_id: user.user.id,
        config: JSON.stringify(viewData.config), // Convert config to JSON for storage
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create view: ${error.message}`);
    }

    // Parse the config back to object for validation
    const parsedData = {
      ...data,
      config: typeof data.config === 'string' ? JSON.parse(data.config) : data.config,
    };

    // Zod validation
    const validatedView = ViewSchema.parse(parsedData);
    return validatedView;
  } catch (error) {
    console.error('ViewService.createView error:', error);
    throw error;
  }
};

export const updateView = async (viewId: string, updates: UpdateViewData): Promise<View> => {
  try {
    // Prepare the update object
    const updateData: any = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // If config is being updated, stringify it for storage
    if (updates.config) {
      updateData.config = JSON.stringify(updates.config);
    }

    const { data, error } = await supabase
      .from('views')
      .update(updateData)
      .eq('id', viewId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update view: ${error.message}`);
    }

    // Parse the config back to object for validation
    const parsedData = {
      ...data,
      config: typeof data.config === 'string' ? JSON.parse(data.config) : data.config,
    };

    // Zod validation
    const validatedView = ViewSchema.parse(parsedData);
    return validatedView;
  } catch (error) {
    console.error('ViewService.updateView error:', error);
    throw error;
  }
};

export const deleteView = async (viewId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('views')
      .delete()
      .eq('id', viewId);

    if (error) {
      throw new Error(`Failed to delete view: ${error.message}`);
    }
  } catch (error) {
    console.error('ViewService.deleteView error:', error);
    throw error;
  }
};