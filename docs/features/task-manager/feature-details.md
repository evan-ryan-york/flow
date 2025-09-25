# Task Manager Feature Details

## Overview
This document details the core task management functionality within Perfect Task App's Column 2 (Task Hub), specifically focusing on task creation and task viewing capabilities.

## Task Hub Architecture (Column 2)

The Task Hub is the central column of the three-column layout and consists of three horizontal sections:
1. **Top Row: Quick-Add Bar** - Task creation interface
2. **Middle Row: Task View** - Primary task display and interaction area
3. **Bottom Row: Saved Views** - Personalization layer (covered separately)

## Quick-Add Bar (Top Row)

### Core Functionality
The Quick-Add Bar provides rapid task capture with minimal friction, supporting the "Capture Everything, Organize Later" philosophy.

#### Basic Task Creation
- **Primary Interface**: Always-visible text input field
- **User Flow**:
  1. User types task name (e.g., "Draft marketing email")
  2. Presses `Enter`
  3. Task is instantly created and appears in Task View below

#### Default Task Properties
When a task is created via quick-add:
- `projectId`: Defaults to the last project the user added a task to, or General project if no previous task exists
- `assignedTo`: Defaults to current user
- `status`: Defaults to "To-Do"
- `createdAt`: Current timestamp
- `createdBy`: Current user

#### Expanded Properties Mode
- **Trigger**: Small button (`+` or `...`) next to input field
- **Available Properties**:
  - Project selection
  - Due Date picker
  - Assignee selection
  - Custom properties (based on selected project)

#### Sticky Properties System
The system remembers properties from the last created task:
- **Project Persistence**: The most recently used project becomes the default for new tasks
- **Example**: User creates task for "Work" project with due date of tomorrow
- **Result**: Next task defaults to "Work" project and tomorrow's due date
- **Behavior**: Properties persist until user changes them or session ends

#### In-line Project Selection (`/in` Command)
Users can specify project assignment directly within the task name using the `/in` command:

- **Syntax**: `[task name] /in [project name]`
- **Example**: User types "Buy milk /in groceries"
- **Autocomplete**: Typing `/in` triggers project autocomplete dropdown
- **Project Matching**: Supports partial matching (e.g., `/in gro` matches "Groceries")
- **Visual Feedback**: Selected project appears as a chip at the end of input field
- **Final Result**: Task "Buy milk" is created in the "Groceries" project

**User Flow**:
1. User types task name: "Buy milk"
2. User types " /in gro"
3. Autocomplete dropdown shows matching projects ("Groceries")
4. User clicks "Groceries" or presses Tab/Enter to select
5. Project chip appears: "Buy milk [Groceries]"
6. User presses Enter to create task
7. Task is created in Groceries project

### User Experience Goals
- **Speed**: Task creation in under 5 seconds
- **Minimal Clicks**: Single Enter press for basic tasks
- **Contextual Defaults**: Intelligent property suggestions based on history
- **No Interruption**: Doesn't break user's current focus

## Task View (Middle Row)

### Core Display Functionality
The Task View serves as the primary interface for viewing and interacting with tasks.

#### Dynamic Filtering
- **Project-Based**: Automatically updates based on Column 1 project selections
- **Default View**: Shows "All Tasks" assigned to current user
- **Multi-Project**: Can display combined tasks from multiple selected projects

#### Task List Properties
Each task displays:
- **Task Name**: Primary identifier
- **Project Badge**: Visual project association
- **Due Date**: When applicable
- **Status Indicator**: Visual status representation
- **Custom Properties**: Project-specific fields

#### Interactive Capabilities
- **Draggable Tasks**: Each task can be dragged to Calendar (Column 3)
- **In-line Editing**: Click-to-edit task properties
- **Status Toggle**: Quick completion marking
- **Task Expansion**: Click to view full details

### Responsive Behavior
- **Real-time Updates**: Automatically reflects changes from other users
- **Filter Synchronization**: Instantly updates when Column 1 selections change
- **Smooth Transitions**: Animated task additions/removals

## Task Data Structure

### Core Task Schema
```typescript
interface Task {
  taskId: string;           // Unique identifier
  taskName: string;         // Display name
  description?: string;     // Optional markdown description
  createdAt: timestamp;     // Creation time
  createdBy: string;        // User ID of creator
  assignedTo: string;       // User ID of assignee
  projectId: string;        // Associated project
  dueDate?: date;          // Optional due date
  status: string;          // "To-Do", "In Progress", "Done", etc.
}
```

### Custom Properties Integration
Tasks can have additional project-specific properties:
- **Dynamic Fields**: Based on project's custom property definitions
- **Type Safety**: Validated against project schema
- **UI Adaptation**: Form fields adapt to property types (text, select, date)

## User Workflows

### Rapid Task Capture
1. User has idea/task
2. Clicks in Quick-Add Bar (or uses keyboard shortcut)
3. Types task name
4. Presses Enter
5. Task appears immediately in Task View (assigned to last-used project)
6. User continues with current work (no context switch)

### In-line Project Assignment
1. User types task name: "Buy milk"
2. User adds project command: " /in groceries"
3. Autocomplete dropdown appears with matching projects
4. User selects project (click or Tab/Enter)
5. Project chip appears in input field
6. User presses Enter to create task
7. Task is created in specified project
8. Project becomes new default for subsequent tasks

### Detailed Task Creation
1. User clicks expand button in Quick-Add Bar
2. Property form appears inline
3. User selects project, due date, assignee
4. Types task name
5. Presses Enter or Create button
6. Task appears with all specified properties

### Task Interaction
1. User sees task in Task View
2. Can drag to calendar for scheduling
3. Can click to edit properties inline
4. Can mark complete with status toggle
5. Can expand for full details/description

## Performance Considerations
- **Instant Feedback**: Task creation provides immediate visual confirmation
- **Optimistic Updates**: UI updates before server confirmation
- **Caching**: TanStack Query manages task list caching
- **Real-time Sync**: Supabase subscriptions for live collaboration

## Database Schema Updates Required

### User Preferences Table
A new table or user profile extension is needed to track the last-used project:

```sql
-- Option 1: Add column to existing profiles table
ALTER TABLE profiles
ADD COLUMN last_used_project_id UUID REFERENCES projects(id);

-- Option 2: Create separate user_preferences table
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  last_used_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Update Logic
- When a task is created, update the user's `last_used_project_id`
- On subsequent task creation, use this project as the default
- If `last_used_project_id` is null or references a deleted project, fall back to General project

## Technical Implementation Notes
- **Backend**: Supabase with Row-Level Security policies
- **State Management**: TanStack Query for server state
- **Validation**: Zod schemas for type safety
- **Real-time**: Supabase real-time subscriptions
- **UI Components**: shadcn/ui components for consistent styling
- **Autocomplete**: Real-time project search with debouncing for performance
- **Text Parsing**: Parse `/in` commands and extract project identifiers
- **Visual Feedback**: Dynamic chip component for selected projects