# Project Manager Feature - Implementation Plan

**Feature:** Column 1 Navigation Panel (Project Manager)
**Target Delivery:** Complete end-to-end implementation
**Dependencies:** Authentication system, Supabase database, UI package

## Implementation Overview

This plan follows the **Golden Path** data flow architecture and the testing strategy outlined in the project documentation. We'll implement from the database up through the UI, ensuring each layer is fully tested before moving to the next.

```
Implementation Flow:
Database Schema → Service Layer → Hook Layer → UI Components → Integration → Testing
```

## Phase 1: Database Foundation

### Step 1.1: Schema Modifications

**File:** `supabase/migrations/YYYYMMDDHHMMSS_add_project_manager_fields.sql`

```sql
-- Add new columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_color VARCHAR(7) DEFAULT '#3B82F6';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_projects_owner_display_order
ON projects(owner_id, display_order);

-- Add constraint to prevent deletion of default projects
ALTER TABLE projects ADD CONSTRAINT check_default_project_not_deletable
CHECK (is_default = FALSE OR id NOT IN (
  SELECT id FROM projects WHERE is_default = TRUE AND owner_id != auth.uid()
));
```

**Testing:** Create migration and test locally with `supabase db push`

### Step 1.2: Update Profile Creation Trigger

**File:** Update existing trigger function in database

```sql
-- Update the create_profile_for_new_user trigger function
CREATE OR REPLACE FUNCTION create_profile_for_new_user()
RETURNS trigger AS $$
BEGIN
  -- Create user profile
  INSERT INTO profiles (id, email, name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name');

  -- Create default "General" project for new user
  INSERT INTO projects (project_name, owner_id, is_default, project_color, display_order)
  VALUES ('General', NEW.id, TRUE, '#6B7280', 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Testing:**
- Test with new user signup
- Verify General project is created automatically
- Verify RLS policies still work correctly

### Step 1.3: Update Zod Schemas

**File:** `packages/models/project.ts`

```typescript
import { z } from 'zod';

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  project_name: z.string().min(1).max(50),
  owner_id: z.string().uuid(),
  created_at: z.string().datetime(),
  is_default: z.boolean().default(false),
  project_color: z.string().regex(/^#[0-9A-F]{6}$/i).default('#3B82F6'),
  display_order: z.number().int().min(0).default(0),
});

export const CreateProjectSchema = z.object({
  project_name: z.string().min(1).max(50).trim(),
  project_color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
});

export const UpdateProjectSchema = z.object({
  project_name: z.string().min(1).max(50).trim().optional(),
  project_color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  display_order: z.number().int().min(0).optional(),
});

export type Project = z.infer<typeof ProjectSchema>;
export type CreateProject = z.infer<typeof CreateProjectSchema>;
export type UpdateProject = z.infer<typeof UpdateProjectSchema>;
```

**Testing:**
- Unit tests for schema validation
- Test edge cases (empty strings, invalid colors, etc.)

## Phase 2: Service Layer (Golden Path Step 3)

### Step 2.1: Project Service Functions

**File:** `packages/data/services/projectService.ts`

```typescript
import { supabase } from '../supabase';
import { ProjectSchema, CreateProjectSchema, UpdateProjectSchema } from '@perfect-task-app/models';
import type { Project, CreateProject, UpdateProject } from '@perfect-task-app/models';

/**
 * Get all projects for a user, with General project always first
 */
export const getProjectsForUser = async (userId: string): Promise<Project[]> => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', userId)
      .order('is_default', { ascending: false })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch projects: ${error.message}`);
    }

    const validatedProjects = ProjectSchema.array().parse(data);
    return validatedProjects;
  } catch (error) {
    console.error('ProjectService.getProjectsForUser error:', error);
    throw error;
  }
};

/**
 * Create a new project
 */
export const createProject = async (data: CreateProject & { userId: string }): Promise<Project> => {
  try {
    // Validate input
    const validatedInput = CreateProjectSchema.parse(data);

    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        project_name: validatedInput.project_name,
        owner_id: data.userId,
        project_color: validatedInput.project_color || '#3B82F6',
        is_default: false,
        display_order: 999, // New projects go at the end
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create project: ${error.message}`);
    }

    const validatedProject = ProjectSchema.parse(newProject);
    return validatedProject;
  } catch (error) {
    console.error('ProjectService.createProject error:', error);
    throw error;
  }
};

/**
 * Update project properties
 */
export const updateProject = async (projectId: string, data: UpdateProject): Promise<Project> => {
  try {
    const validatedInput = UpdateProjectSchema.parse(data);

    const { data: updatedProject, error } = await supabase
      .from('projects')
      .update(validatedInput)
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update project: ${error.message}`);
    }

    const validatedProject = ProjectSchema.parse(updatedProject);
    return validatedProject;
  } catch (error) {
    console.error('ProjectService.updateProject error:', error);
    throw error;
  }
};

/**
 * Delete a project (with safeguards)
 */
export const deleteProject = async (projectId: string): Promise<void> => {
  try {
    // First check if this is a default project
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('is_default')
      .eq('id', projectId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch project: ${fetchError.message}`);
    }

    if (project.is_default) {
      throw new Error('Cannot delete the default General project');
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
 * Get the default "General" project for a user
 */
export const getDefaultProject = async (userId: string): Promise<Project | null> => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', userId)
      .eq('is_default', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No default project found
      }
      throw new Error(`Failed to fetch default project: ${error.message}`);
    }

    const validatedProject = ProjectSchema.parse(data);
    return validatedProject;
  } catch (error) {
    console.error('ProjectService.getDefaultProject error:', error);
    throw error;
  }
};
```

**Testing Requirements:**
- Create `packages/data/services/__tests__/projectService.test.ts`
- Test all CRUD operations against live local Supabase
- Test RLS policies (user can only access own projects)
- Test edge cases (non-existent IDs, invalid data)
- Test General project protection (cannot delete)

## Phase 3: Hook Layer (Golden Path Step 2)

### Step 3.1: Project Hooks

**File:** `packages/data/hooks/useProject.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProjectsForUser,
  createProject,
  updateProject,
  deleteProject,
  getDefaultProject,
  reassignProjectTasks
} from '../services/projectService';
import type { CreateProject, UpdateProject } from '@perfect-task-app/models';

/**
 * Get all projects for a user
 */
export const useUserProjects = (userId: string) => {
  return useQuery({
    queryKey: ['projects', userId],
    queryFn: () => getProjectsForUser(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Get default "General" project for a user
 */
export const useDefaultProject = (userId: string) => {
  return useQuery({
    queryKey: ['projects', 'default', userId],
    queryFn: () => getDefaultProject(userId),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes (rarely changes)
  });
};

/**
 * Create a new project
 */
export const useCreateProject = (userId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProject) => createProject({ ...data, userId }),
    onSuccess: (newProject) => {
      // Invalidate projects list to include new project
      queryClient.invalidateQueries({ queryKey: ['projects', userId] });

      // Optionally add to cache optimistically
      queryClient.setQueryData(['projects', userId], (old: any) => {
        if (old) {
          return [...old, newProject];
        }
        return [newProject];
      });
    },
    onError: (error) => {
      console.error('Failed to create project:', error);
    },
  });
};

/**
 * Update a project
 */
export const useUpdateProject = (userId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: UpdateProject }) =>
      updateProject(projectId, data),
    onSuccess: (updatedProject) => {
      // Update projects list cache
      queryClient.setQueryData(['projects', userId], (old: any) => {
        if (old) {
          return old.map((p: any) =>
            p.id === updatedProject.id ? updatedProject : p
          );
        }
        return [updatedProject];
      });
    },
    onError: (error) => {
      console.error('Failed to update project:', error);
    },
  });
};

/**
 * Delete a project
 */
export const useDeleteProject = (userId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      reassignToProjectId
    }: {
      projectId: string;
      reassignToProjectId?: string;
    }) => {
      // Reassign tasks if specified
      if (reassignToProjectId) {
        await reassignProjectTasks(projectId, reassignToProjectId);
      }

      // Delete the project
      await deleteProject(projectId);

      return projectId;
    },
    onSuccess: (deletedProjectId) => {
      // Remove from projects cache
      queryClient.setQueryData(['projects', userId], (old: any) => {
        if (old) {
          return old.filter((p: any) => p.id !== deletedProjectId);
        }
        return [];
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      console.error('Failed to delete project:', error);
    },
  });
};
```

**Testing Requirements:**
- Create `packages/data/hooks/__tests__/useProject.test.ts`
- Mock service layer functions
- Test loading, success, and error states
- Test cache invalidation logic
- Test optimistic updates

## Phase 4: UI Components (Golden Path Step 1)

### Step 4.1: Core Project Components

**File:** `packages/ui/components/custom/ProjectsPanel.tsx`

```typescript
import React, { useState } from 'react';
import { cn } from '@perfect-task-app/ui';
import { Card } from '@perfect-task-app/ui';
import { ProjectItem } from './ProjectItem';
import { AddProjectButton } from './AddProjectButton';
import { useUserProjects, useCreateProject } from '@perfect-task-app/data';
import type { Project } from '@perfect-task-app/models';

interface ProjectsPanelProps {
  userId: string;
  selectedProjectIds: string[];
  onProjectSelectionChange: (projectIds: string[]) => void;
  className?: string;
}

export function ProjectsPanel({
  userId,
  selectedProjectIds,
  onProjectSelectionChange,
  className
}: ProjectsPanelProps) {
  const { data: projects, isLoading, isError, error } = useUserProjects(userId);
  const createProjectMutation = useCreateProject(userId);

  const handleProjectClick = (projectId: string, isCtrlClick: boolean) => {
    if (isCtrlClick) {
      // Multi-select mode
      const newSelection = selectedProjectIds.includes(projectId)
        ? selectedProjectIds.filter(id => id !== projectId)
        : [...selectedProjectIds, projectId];
      onProjectSelectionChange(newSelection);
    } else {
      // Single select mode
      const newSelection = selectedProjectIds.includes(projectId) && selectedProjectIds.length === 1
        ? [] // Deselect if it's the only selected project
        : [projectId];
      onProjectSelectionChange(newSelection);
    }
  };

  const handleCreateProject = async (projectName: string) => {
    try {
      const newProject = await createProjectMutation.mutateAsync({
        project_name: projectName,
      });

      // Auto-select the new project
      onProjectSelectionChange([newProject.id]);
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  if (isLoading) {
    return (
      <Card className={cn('p-4', className)}>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </div>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className={cn('p-4', className)}>
        <div className="text-red-500 text-sm">
          Failed to load projects: {error?.message}
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="font-semibold text-sm text-gray-700">Projects</h2>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {projects?.map((project) => (
            <ProjectItem
              key={project.id}
              project={project}
              isSelected={selectedProjectIds.includes(project.id)}
              onClick={handleProjectClick}
              userId={userId}
            />
          ))}
        </div>
      </div>

      {/* Add Project Button */}
      <div className="p-4 border-t">
        <AddProjectButton
          onCreateProject={handleCreateProject}
          isLoading={createProjectMutation.isPending}
        />
      </div>
    </Card>
  );
}
```

**File:** `packages/ui/components/custom/ProjectItem.tsx`

```typescript
import React from 'react';
import { cn, Button, Badge } from '@perfect-task-app/ui';
import { ProjectContextMenu } from './ProjectContextMenu';
import type { Project } from '@perfect-task-app/models';

interface ProjectItemProps {
  project: Project;
  isSelected: boolean;
  onClick: (projectId: string, isCtrlClick: boolean) => void;
  userId: string;
  className?: string;
}

export function ProjectItem({
  project,
  isSelected,
  onClick,
  userId,
  className
}: ProjectItemProps) {
  const handleClick = (event: React.MouseEvent) => {
    const isCtrlClick = event.ctrlKey || event.metaKey;
    onClick(project.id, isCtrlClick);
  };

  return (
    <div className={cn('group relative', className)}>
      <Button
        variant="ghost"
        className={cn(
          'w-full justify-start h-auto p-2 font-normal',
          isSelected && 'bg-blue-50 text-blue-700 border-blue-200'
        )}
        onClick={handleClick}
      >
        {/* Color indicator */}
        <div
          className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
          style={{ backgroundColor: project.project_color }}
        />

        {/* Project name */}
        <span className="flex-1 text-left truncate">
          {project.project_name}
        </span>

        {/* Default badge */}
        {project.is_default && (
          <Badge variant="secondary" className="ml-2 text-xs">
            Default
          </Badge>
        )}
      </Button>

      {/* Context menu (only for non-default projects) */}
      {!project.is_default && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <ProjectContextMenu project={project} userId={userId} />
        </div>
      )}
    </div>
  );
}
```

**File:** `packages/ui/components/custom/AddProjectButton.tsx`

```typescript
import React, { useState } from 'react';
import { Button, Input } from '@perfect-task-app/ui';
import { Plus, Check, X } from 'lucide-react';

interface AddProjectButtonProps {
  onCreateProject: (name: string) => Promise<void>;
  isLoading: boolean;
}

export function AddProjectButton({ onCreateProject, isLoading }: AddProjectButtonProps) {
  const [isInputMode, setIsInputMode] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmedValue = inputValue.trim();

    if (!trimmedValue) {
      setError('Project name is required');
      return;
    }

    if (trimmedValue.length > 50) {
      setError('Project name must be 50 characters or less');
      return;
    }

    try {
      await onCreateProject(trimmedValue);
      setInputValue('');
      setIsInputMode(false);
      setError(null);
    } catch (err) {
      setError('Failed to create project');
    }
  };

  const handleCancel = () => {
    setInputValue('');
    setIsInputMode(false);
    setError(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSubmit();
    } else if (event.key === 'Escape') {
      handleCancel();
    }
  };

  if (isInputMode) {
    return (
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Project name..."
            className="flex-1"
            autoFocus
            disabled={isLoading}
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            disabled={isLoading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {error && (
          <div className="text-red-500 text-xs">{error}</div>
        )}
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      className="w-full justify-start"
      onClick={() => setIsInputMode(true)}
      disabled={isLoading}
    >
      <Plus className="h-4 w-4 mr-2" />
      Add Project
    </Button>
  );
}
```

### Step 4.2: Context Menu and Dialogs

**File:** `packages/ui/components/custom/ProjectContextMenu.tsx`

```typescript
import React, { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button
} from '@perfect-task-app/ui';
import { MoreHorizontal, Edit, Trash2, Palette } from 'lucide-react';
import { DeleteProjectDialog } from './DeleteProjectDialog';
import { RenameProjectDialog } from './RenameProjectDialog';
import { ColorPickerDialog } from './ColorPickerDialog';
import type { Project } from '@perfect-task-app/models';

interface ProjectContextMenuProps {
  project: Project;
  userId: string;
}

export function ProjectContextMenu({ project, userId }: ProjectContextMenuProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showColorDialog, setShowColorDialog] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48" align="end">
          <div className="space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                setShowRenameDialog(true);
                setIsOpen(false);
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Rename
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                setShowColorDialog(true);
                setIsOpen(false);
              }}
            >
              <Palette className="h-4 w-4 mr-2" />
              Change Color
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 hover:text-red-700"
              onClick={() => {
                setShowDeleteDialog(true);
                setIsOpen(false);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <DeleteProjectDialog
        project={project}
        userId={userId}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />

      <RenameProjectDialog
        project={project}
        userId={userId}
        open={showRenameDialog}
        onOpenChange={setShowRenameDialog}
      />

      <ColorPickerDialog
        project={project}
        userId={userId}
        open={showColorDialog}
        onOpenChange={setShowColorDialog}
      />
    </>
  );
}
```

### Step 4.3: Export Components

**File:** Update `packages/ui/custom.ts`

```typescript
// Existing exports...

// Project Manager Components
export * from './components/custom/ProjectsPanel';
export * from './components/custom/ProjectItem';
export * from './components/custom/AddProjectButton';
export * from './components/custom/ProjectContextMenu';
export * from './components/custom/DeleteProjectDialog';
export * from './components/custom/RenameProjectDialog';
export * from './components/custom/ColorPickerDialog';
```

## Phase 5: Testing Implementation

### Step 5.1: Service Layer Integration Tests

**File:** `packages/data/services/__tests__/projectService.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { supabase } from '../supabase';
import {
  getProjectsForUser,
  createProject,
  updateProject,
  deleteProject,
  getDefaultProject,
  reassignProjectTasks
} from '../projectService';

describe('ProjectService Integration Tests', () => {
  let testUserId: string;
  let testUser2Id: string;

  beforeEach(async () => {
    // Reset database to clean state
    await supabase.from('tasks').delete().neq('id', 'fake-id');
    await supabase.from('projects').delete().neq('id', 'fake-id');
    await supabase.from('profiles').delete().neq('id', 'fake-id');

    // Create test users
    const { data: user1 } = await supabase.auth.signUp({
      email: 'test1@example.com',
      password: 'password123'
    });
    testUserId = user1.user!.id;

    const { data: user2 } = await supabase.auth.signUp({
      email: 'test2@example.com',
      password: 'password123'
    });
    testUser2Id = user2.user!.id;
  });

  describe('getProjectsForUser', () => {
    it('should return projects with General project first', async () => {
      const projects = await getProjectsForUser(testUserId);

      expect(projects).toHaveLength(1);
      expect(projects[0].project_name).toBe('General');
      expect(projects[0].is_default).toBe(true);
      expect(projects[0].owner_id).toBe(testUserId);
    });

    it('should enforce RLS - only return user\'s own projects', async () => {
      // User 1 creates a project
      await createProject({
        project_name: 'User 1 Project',
        userId: testUserId
      });

      // User 2 should not see User 1's project
      const user2Projects = await getProjectsForUser(testUser2Id);
      expect(user2Projects).toHaveLength(1); // Only their General project
      expect(user2Projects[0].project_name).toBe('General');
    });
  });

  describe('createProject', () => {
    it('should create a project successfully', async () => {
      const newProject = await createProject({
        project_name: 'Test Project',
        userId: testUserId
      });

      expect(newProject.project_name).toBe('Test Project');
      expect(newProject.owner_id).toBe(testUserId);
      expect(newProject.is_default).toBe(false);
      expect(newProject.project_color).toBe('#3B82F6');
    });

    it('should validate project name length', async () => {
      await expect(createProject({
        project_name: '',
        userId: testUserId
      })).rejects.toThrow();

      await expect(createProject({
        project_name: 'a'.repeat(51),
        userId: testUserId
      })).rejects.toThrow();
    });
  });

  describe('deleteProject', () => {
    it('should prevent deletion of default project', async () => {
      const projects = await getProjectsForUser(testUserId);
      const generalProject = projects.find(p => p.is_default);

      await expect(deleteProject(generalProject!.id))
        .rejects.toThrow('Cannot delete the default General project');
    });

    it('should delete non-default projects', async () => {
      const project = await createProject({
        project_name: 'Deletable Project',
        userId: testUserId
      });

      await deleteProject(project.id);

      const projects = await getProjectsForUser(testUserId);
      expect(projects.find(p => p.id === project.id)).toBeUndefined();
    });
  });

  afterEach(async () => {
    // Clean up
    await supabase.auth.signOut();
  });
});
```

### Step 5.2: Hook Unit Tests

**File:** `packages/data/hooks/__tests__/useProject.test.ts`

```typescript
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUserProjects, useCreateProject } from '../useProject';
import * as projectService from '../../services/projectService';

// Mock the service layer
jest.mock('../../services/projectService');
const mockedProjectService = projectService as jest.Mocked<typeof projectService>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useProject hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useUserProjects', () => {
    it('should return loading state initially', () => {
      mockedProjectService.getProjectsForUser.mockImplementation(() =>
        new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(
        () => useUserProjects('test-user-id'),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('should return projects on successful fetch', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          project_name: 'General',
          owner_id: 'test-user-id',
          is_default: true,
          project_color: '#6B7280',
          display_order: 0,
          created_at: '2023-01-01T00:00:00Z'
        }
      ];

      mockedProjectService.getProjectsForUser.mockResolvedValue(mockProjects);

      const { result } = renderHook(
        () => useUserProjects('test-user-id'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockProjects);
    });

    it('should handle error states', async () => {
      const error = new Error('Failed to fetch projects');
      mockedProjectService.getProjectsForUser.mockRejectedValue(error);

      const { result } = renderHook(
        () => useUserProjects('test-user-id'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(error);
    });
  });

  describe('useCreateProject', () => {
    it('should create project and invalidate cache', async () => {
      const newProject = {
        id: 'new-project-id',
        project_name: 'New Project',
        owner_id: 'test-user-id',
        is_default: false,
        project_color: '#3B82F6',
        display_order: 999,
        created_at: '2023-01-01T00:00:00Z'
      };

      mockedProjectService.createProject.mockResolvedValue(newProject);

      const { result } = renderHook(
        () => useCreateProject('test-user-id'),
        { wrapper: createWrapper() }
      );

      result.current.mutate({ project_name: 'New Project' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(newProject);
    });
  });
});
```

### Step 5.3: Component Tests

**File:** `packages/ui/components/custom/__tests__/ProjectsPanel.test.tsx`

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectsPanel } from '../ProjectsPanel';
import * as useProjectHooks from '@perfect-task-app/data';

// Mock the hooks
jest.mock('@perfect-task-app/data');
const mockedHooks = useProjectHooks as jest.Mocked<typeof useProjectHooks>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('ProjectsPanel', () => {
  const mockProps = {
    userId: 'test-user-id',
    selectedProjectIds: [],
    onProjectSelectionChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state', () => {
    mockedHooks.useUserProjects.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as any);

    render(<ProjectsPanel {...mockProps} />, { wrapper: createWrapper() });

    expect(screen.getByTestId('loading-skeleton')).toBeTruthy();
  });

  it('should render projects list', () => {
    const mockProjects = [
      {
        id: 'general-id',
        project_name: 'General',
        is_default: true,
        project_color: '#6B7280',
      },
      {
        id: 'project-1',
        project_name: 'Work Project',
        is_default: false,
        project_color: '#3B82F6',
      }
    ];

    mockedHooks.useUserProjects.mockReturnValue({
      data: mockProjects,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    render(<ProjectsPanel {...mockProps} />, { wrapper: createWrapper() });

    expect(screen.getByText('General')).toBeTruthy();
    expect(screen.getByText('Work Project')).toBeTruthy();
  });

  it('should handle project selection', () => {
    const mockProjects = [
      {
        id: 'general-id',
        project_name: 'General',
        is_default: true,
        project_color: '#6B7280',
      }
    ];

    mockedHooks.useUserProjects.mockReturnValue({
      data: mockProjects,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    render(<ProjectsPanel {...mockProps} />, { wrapper: createWrapper() });

    const projectButton = screen.getByText('General');
    fireEvent.press(projectButton);

    expect(mockProps.onProjectSelectionChange).toHaveBeenCalledWith(['general-id']);
  });
});
```

## Phase 6: Integration and Deployment

### Step 6.1: Integration with Main App

**File:** `apps/web/app/dashboard/page.tsx` (Example integration)

```typescript
import React, { useState } from 'react';
import { ProjectsPanel } from '@perfect-task-app/ui/custom';
import { useAuth } from '@perfect-task-app/data';

export default function DashboardPage() {
  const { user } = useAuth();
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  if (!user) {
    return <div>Please log in</div>;
  }

  return (
    <div className="flex h-screen">
      {/* Column 1: Projects Panel */}
      <div className="w-64 border-r">
        <ProjectsPanel
          userId={user.id}
          selectedProjectIds={selectedProjectIds}
          onProjectSelectionChange={setSelectedProjectIds}
        />
      </div>

      {/* Column 2: Task Hub (placeholder) */}
      <div className="flex-1 p-4">
        <h2>Task Hub</h2>
        <p>Selected projects: {selectedProjectIds.join(', ')}</p>
      </div>

      {/* Column 3: Calendar (placeholder) */}
      <div className="w-80 border-l p-4">
        <h2>Calendar</h2>
      </div>
    </div>
  );
}
```

### Step 6.2: E2E Testing

**File:** `apps/web/__tests__/e2e/project-manager.e2e.test.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Project Manager E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Sign up and log in a test user
    await page.goto('/auth/signup');
    // ... authentication flow
    await page.goto('/dashboard');
  });

  test('should show General project by default', async ({ page }) => {
    await expect(page.locator('[data-testid="project-item"]').first()).toContainText('General');
  });

  test('should create a new project', async ({ page }) => {
    // Click add project button
    await page.click('[data-testid="add-project-button"]');

    // Type project name
    await page.fill('[data-testid="project-name-input"]', 'Test Project');
    await page.press('[data-testid="project-name-input"]', 'Enter');

    // Verify project appears in list
    await expect(page.locator('text=Test Project')).toBeVisible();
  });

  test('should select and deselect projects', async ({ page }) => {
    // Create a test project first
    await page.click('[data-testid="add-project-button"]');
    await page.fill('[data-testid="project-name-input"]', 'Test Project');
    await page.press('[data-testid="project-name-input"]', 'Enter');

    // Click to select
    await page.click('text=Test Project');
    await expect(page.locator('[data-testid="selected-projects"]')).toContainText('Test Project');

    // Click again to deselect
    await page.click('text=Test Project');
    await expect(page.locator('[data-testid="selected-projects"]')).not.toContainText('Test Project');
  });

  test('should support multi-select with Ctrl+Click', async ({ page }) => {
    // Create a test project
    await page.click('[data-testid="add-project-button"]');
    await page.fill('[data-testid="project-name-input"]', 'Test Project');
    await page.press('[data-testid="project-name-input"]', 'Enter');

    // Select General project
    await page.click('text=General');

    // Ctrl+Click Test Project to add to selection
    await page.click('text=Test Project', { modifiers: ['Control'] });

    // Verify both are selected
    const selectedText = await page.locator('[data-testid="selected-projects"]').textContent();
    expect(selectedText).toContain('General');
    expect(selectedText).toContain('Test Project');
  });
});
```

## Phase 7: Quality Gates and Launch

### Step 7.1: Pre-Launch Checklist

- [ ] All database migrations tested and deployed
- [ ] Service layer: 100% test coverage, all integration tests passing
- [ ] Hook layer: All hooks tested, cache invalidation verified
- [ ] UI components: All components tested, accessibility verified
- [ ] Cross-platform compatibility: Tested on Web, iOS, Android, Desktop
- [ ] Performance: Project list renders <100ms for 100+ projects
- [ ] E2E tests: All critical user journeys passing
- [ ] Error handling: Graceful degradation for all failure modes
- [ ] TypeScript: Zero type errors across entire codebase

### Step 7.2: Deployment Strategy

1. **Database First**: Deploy migration to add new columns
2. **Backend Services**: Deploy service layer updates
3. **Frontend Components**: Deploy UI components and hooks
4. **Integration**: Deploy main app integration
5. **Monitoring**: Set up error tracking and performance monitoring

## Success Metrics

- **Functional**: Users can create, select, and manage projects
- **Performance**: Project operations complete in <200ms
- **Reliability**: <0.1% error rate for project operations
- **Usability**: Users can complete project management without documentation
- **Cross-platform**: Identical functionality across all platforms

This implementation plan follows the Golden Path architecture, ensures comprehensive testing coverage, and provides a production-ready project management feature that serves as the foundation for the entire Perfect Task App experience.