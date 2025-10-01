# Golden Path: Data Flow Architecture

## High-Level Overview: The Data Journey

The core principle is a clear separation of concerns. A UI component should never know how to fetch or mutate data; it only knows that it needs data and what to do with it.

Here is the step-by-step journey of data from the database to the user's screen:

1. **UI Layer (React Component)**: A screen or component mounts and needs data to render.

2. **Hook Layer (TanStack Query)**: The component calls a custom React Hook (e.g., `useProjectTasks`). This hook encapsulates all data-fetching logic.

3. **Data Layer (Supabase Client Service)**: The hook's query function calls a dedicated, async "service" function that knows how to communicate with Supabase.

4. **Backend (Supabase)**: The service function makes a request to the Supabase API. Supabase processes the request, checks Row-Level Security (RLS) policies, and returns raw JSON data from the PostgreSQL database.

5. **Validation Layer (Zod)**: The data layer service receives the raw JSON and immediately validates it against a Zod schema. If the data's shape is incorrect, an error is thrown; otherwise, the data is now fully type-safe.

6. **Caching Layer (TanStack Query)**: The validated, type-safe data is passed back to TanStack Query, which automatically caches it, manages its "freshness," and provides status flags (`isLoading`, `isError`, `data`) to the hook.

7. **UI Layer (React Component Renders)**: The component receives the data and status flags from the hook and renders the appropriate UI (a loading spinner, an error message, or the data itself).

## Detailed Breakdown of the Golden Flow

Let's walk through a practical example: A user clicks on the "Q4 Marketing" project in the sidebar.

### Step 1: The Route and UI Component

Expo Router handles the navigation. The user is taken to a dynamic route like `/projects/[id]`, where `id` is the `projectId` for "Q4 Marketing".

The corresponding file, `apps/mobile/app/projects/[id].tsx`, renders a React component (e.g., `ProjectDetailScreen`).

This component needs to display all the tasks for that project. It does not contain any fetch logic. Instead, it calls our custom hook:

```typescript
// In component ProjectDetailScreen.tsx
const { projectId } = useLocalSearchParams(); // From Expo Router
const { data: tasks, isLoading, isError } = useProjectTasks(projectId);

if (isLoading) return <LoadingSpinner />;
if (isError) return <ErrorMessage />;

return <TaskList tasks={tasks} />;
```

### Step 2: The Custom Hook (useProjectTasks) - The Role of TanStack Query

This is where TanStack Query comes in. It acts as the orchestrator for server state. We create a custom hook in our shared `packages/data` that wraps `useQuery`.

What it does:

- It defines a unique query key `(['tasks', projectId])` that acts as the identifier for this data in the cache.
- It calls our data-fetching service function (`getTasksForProject`).
- It manages all the complexity: caching, background refetching, and providing simple status flags to the UI.

```typescript
// In packages/data/hooks/useProjectTasks.ts
import { useQuery } from '@tanstack/react-query';
import { getTasksForProject } from '../services/taskService';

export const useProjectTasks = (projectId: string) => {
  return useQuery({
    queryKey: ['tasks', projectId], // Unique key for this data
    queryFn: () => getTasksForProject(projectId), // The function that actually fetches
    enabled: !!projectId, // Don't run the query if projectId is not yet available
  });
};
```

### Step 3 & 4: The Data Service & Supabase Backend

The `queryFn` from our hook calls a function from what we can call a "service" layer. This layer lives in `packages/data` and is the only part of the frontend that should directly interact with the Supabase client.

**Backend Services?** Yes, this is our custom frontend service layer. It's a set of exported functions that abstract away the Supabase API calls.

The `getTasksForProject` function builds the query using the Supabase JS client, executes it, and gets a raw response.

```typescript
// In packages/data/services/taskService.ts
import { supabase } from '../supabaseClient'; // The initialized Supabase client
import { TaskSchema } from '@perfect-task-app/models'; // Import the Zod schema

export const getTasksForProject = async (projectId: string) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('projectId', projectId);

  if (error) throw new Error(error.message);

  // Zod validation happens here!
  const validatedTasks = TaskSchema.array().parse(data);

  return validatedTasks; // Return clean, type-safe data
};
```

### Step 5: Data Validation - The Role of Zod

Right after the data is received from Supabase, we validate it. This is Zod's most critical role.

- Our Zod schemas are defined once in the `packages/models` directory and are the single source of truth for our data shapes.
- By calling `TaskSchema.array().parse(data)`, we transform the raw `any[]` from Supabase into a `Task[]` array with guaranteed types.
- If Supabase ever returns data that doesn't match our schema (e.g., a column was renamed, a null value appears where it shouldn't), the `.parse()` function will throw a descriptive error. TanStack Query catches this error and puts the query into the `isError` state, protecting the rest of our app from crashing due to unexpected data shapes.

### Step 6 & 7: Caching and Rendering

The validated data flows back up the chain:

1. `getTasksForProject` returns the `validatedTasks`.
2. `useQuery` (inside our `useProjectTasks` hook) receives this data.
3. TanStack Query places the data into its cache, associated with the key `['tasks', projectId]`.
4. The `useProjectTasks` hook triggers a re-render in the `ProjectDetailScreen` component.
5. On the first render, `isLoading` was `true`. Now, `isLoading` is `false` and `data` contains our array of tasks.
6. The component renders the `<TaskList tasks={tasks} />`.

If the user navigates away and comes back to this project, TanStack Query will instantly serve the cached data first for a fast UI response, and then refetch in the background to ensure the data is fresh.

## How Real-time Updates Fit In

Supabase's real-time subscriptions integrate beautifully into this flow. We can enhance our `useProjectTasks` hook to listen for changes.

```typescript
// In packages/data/hooks/useProjectTasks.ts (enhanced version)
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getTasksForProject } from '../services/taskService';
import { supabase } from '../supabaseClient';

export const useProjectTasks = (projectId: string) => {
  const queryClient = useQueryClient();
  const queryKey = ['tasks', projectId];

  useEffect(() => {
    // Supabase real-time subscription
    const channel = supabase
      .channel(`tasks-for-${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `projectId=eq.${projectId}`
      }, (payload) => {
        // When a change occurs, invalidate the query.
        // This tells TanStack Query to refetch the data automatically.
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient, queryKey]);

  return useQuery({
    queryKey,
    queryFn: () => getTasksForProject(projectId),
    enabled: !!projectId,
  });
};
```

With this addition, if another user in a collaborative project adds a task, the Supabase subscription will fire, our hook will invalidate the cached data, TanStack Query will automatically refetch, and the UI will update—all without any manual intervention in the component itself.

## Key Principles

### 1. Separation of Concerns
- **UI Components**: Only handle rendering and user interactions
- **Custom Hooks**: Manage data lifecycle and provide clean APIs to components
- **Service Functions**: Handle all direct API communication with Supabase using the shared authenticated client
- **Zod Schemas**: Define and validate data shapes
- **Single Supabase Client**: All services use `getSupabaseClient()` from `packages/data/supabase.ts` for consistent authentication

### 2. Type Safety Throughout
- Raw Supabase responses are immediately validated with Zod
- TypeScript types are inferred from Zod schemas
- No `any` types should exist in the data flow

### 3. Caching Strategy
- Use descriptive, hierarchical query keys: `['entity', id]` or `['entity', 'list', filters]`
- Let TanStack Query handle cache invalidation and background refetching
- Use real-time subscriptions to trigger cache updates

### 4. Error Handling
- Service functions throw errors for failed requests
- Zod validation errors are caught by TanStack Query
- Components receive clean error states via `isError` flag

### 5. Package Organization
- `@perfect-task-app/models`: Zod schemas and TypeScript types
- `@perfect-task-app/data`: Hooks, services, and Supabase client
- `@perfect-task-app/ui`: Pure presentation components

This golden path ensures consistency, maintainability, and type safety across the entire application while leveraging the full power of our chosen technology stack.