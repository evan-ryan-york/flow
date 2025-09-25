import { z } from 'zod';

// ---------------------------------
// 1. Profiles
// ---------------------------------
export const ProfileSchema = z.object({
  id: z.string().uuid(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;


// ---------------------------------
// 2. Projects
// ---------------------------------
export const ProjectSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  project_name: z.string().min(1).max(50),
  is_default: z.boolean().default(false),
  project_color: z.string().regex(/^#[0-9A-F]{6}$/i).default('#3B82F6'),
  display_order: z.number().int().min(0).default(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectSchema = z.object({
  project_name: z.string().min(1).max(50).trim(),
  project_color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
});
export type CreateProject = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z.object({
  project_name: z.string().min(1).max(50).trim().optional(),
  project_color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  display_order: z.number().int().min(0).optional(),
});
export type UpdateProject = z.infer<typeof UpdateProjectSchema>;


// ---------------------------------
// 3. Project Users (Join Table)
// ---------------------------------
export const ProjectUserSchema = z.object({
  project_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(['admin', 'member', 'viewer']), // Using enum for type safety
  joined_at: z.string().datetime(),
});
export type ProjectUser = z.infer<typeof ProjectUserSchema>;


// ---------------------------------
// 4. Tasks
// ---------------------------------
export const TaskSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(), // NOT nullable, every task must have a project
  created_by: z.string().uuid(),
  assigned_to: z.string().uuid().nullable(),
  name: z.string().min(1),
  description: z.string().nullable(),
  due_date: z.string().nullable(),
  status: z.string(), // Added back for Kanban/workflow
  is_completed: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Task = z.infer<typeof TaskSchema>;


// ---------------------------------
// 5. Custom Property Definitions
// ---------------------------------
export const CustomPropertyDefinitionSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  created_by: z.string().uuid(),
  name: z.string().min(1),
  type: z.enum(['text', 'select', 'date', 'number']),
  options: z.any().nullable(), // Kept as `any` to match jsonb flexibility
  display_order: z.number().int(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type CustomPropertyDefinition = z.infer<typeof CustomPropertyDefinitionSchema>;


// ---------------------------------
// 6. Custom Property Values
// ---------------------------------
export const CustomPropertyValueSchema = z.object({
  id: z.string().uuid(),
  task_id: z.string().uuid(),
  definition_id: z.string().uuid(),
  value: z.string(),
  created_by: z.string().uuid(),
  updated_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type CustomPropertyValue = z.infer<typeof CustomPropertyValueSchema>;


// ---------------------------------
// 7. Views
// ---------------------------------
// Define a more specific schema for the 'config' object for better type safety
const ViewConfigSchema = z.object({
    projectIds: z.array(z.string().uuid()),
    groupBy: z.string().optional(),
    sortBy: z.string().optional(),
    visibleProperties: z.array(z.string().uuid()).optional(),
});

export const ViewSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1),
  type: z.enum(['list', 'kanban']),
  config: ViewConfigSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type View = z.infer<typeof ViewSchema>;


// ---------------------------------
// 8. Time Blocks
// ---------------------------------
export const TimeBlockSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  google_calendar_event_id: z.string().nullable(),
  title: z.string(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type TimeBlock = z.infer<typeof TimeBlockSchema>;


// ---------------------------------
// 9. Time Block Tasks (Join Table)
// ---------------------------------
export const TimeBlockTaskSchema = z.object({
  time_block_id: z.string().uuid(),
  task_id: z.string().uuid(),
  added_at: z.string().datetime(),
});
export type TimeBlockTask = z.infer<typeof TimeBlockTaskSchema>;