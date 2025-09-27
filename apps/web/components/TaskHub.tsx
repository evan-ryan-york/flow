'use client';

import React, { useState, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import {
  useProjectsTasks,
  useOptimisticTaskSort,
  useToggleProjectSortMode,
  useRealtimeTaskSync,
  useProjectDefinitions,
  useProjectsForUser,
  useAllProfiles,
  useUpdateTask
} from '@perfect-task-app/data';
import { useQueryClient } from '@tanstack/react-query';
import { TaskQuickAdd } from './TaskQuickAdd';
import { TaskList } from './TaskList';
import { SavedViews } from './SavedViews';
import { TaskItem } from './TaskItem';
import { TaskFiltersBar } from './TaskFiltersBar';
import { Task, CustomPropertyDefinition } from '@perfect-task-app/models';
import {
  FilterState,
  createEmptyFilterState,
  filterTasks
} from '@perfect-task-app/ui/lib/taskFiltering';
import {
  GroupByOption,
  groupTasks
} from '@perfect-task-app/ui/lib/taskGrouping';

interface TaskHubProps {
  userId: string;
  selectedProjectIds: string[];
  selectedViewId: string | null;
  onViewChange: (viewId: string | null) => void;
}

export function TaskHub({ userId, selectedProjectIds, selectedViewId, onViewChange }: TaskHubProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [hasManualOrder, setHasManualOrder] = useState(false);

  // Filter and grouping state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<FilterState>(createEmptyFilterState());
  const [groupBy, setGroupBy] = useState<GroupByOption | null>(null);

  // Fallback to original hook until database migration is applied
  const { data: serverTasks = [], isLoading, error } = useProjectsTasks(userId, selectedProjectIds);

  // Fetch projects and profiles data for grouping
  const { data: allProjects = [] } = useProjectsForUser(userId);
  const { data: allProfiles = [] } = useAllProfiles();

  // Optimistic reordering hooks
  const { optimisticReorder, moveTask, isMoving, error: reorderError } = useOptimisticTaskSort();

  // Task update hook for cross-group drops
  const updateTaskMutation = useUpdateTask();
  const queryClient = useQueryClient();

  // Real-time synchronization
  const { isConnected } = useRealtimeTaskSync(userId, selectedProjectIds);

  // Get custom property definitions for all selected projects
  // We need to call hooks for a fixed maximum number of projects to follow Rules of Hooks
  const project1Definitions = useProjectDefinitions(selectedProjectIds[0] || '');
  const project2Definitions = useProjectDefinitions(selectedProjectIds[1] || '');
  const project3Definitions = useProjectDefinitions(selectedProjectIds[2] || '');
  const project4Definitions = useProjectDefinitions(selectedProjectIds[3] || '');
  const project5Definitions = useProjectDefinitions(selectedProjectIds[4] || '');

  const allCustomProperties = useMemo(() => {
    const definitionMap = new Map<string, CustomPropertyDefinition>();

    // Collect definitions from all active project queries
    const queries = [
      project1Definitions,
      project2Definitions,
      project3Definitions,
      project4Definitions,
      project5Definitions
    ].slice(0, selectedProjectIds.length);

    queries.forEach(query => {
      if (query.data) {
        query.data.forEach(definition => {
          // Use definition ID as key to prevent duplicates
          definitionMap.set(definition.id, definition);
        });
      }
    });

    // Convert map back to array and sort by display order within each project
    return Array.from(definitionMap.values()).sort((a, b) => {
      // First sort by project_id, then by display_order
      if (a.project_id !== b.project_id) {
        return a.project_id.localeCompare(b.project_id);
      }
      return a.display_order - b.display_order;
    });
  }, [
    project1Definitions.data,
    project2Definitions.data,
    project3Definitions.data,
    project4Definitions.data,
    project5Definitions.data,
    selectedProjectIds.length
  ]);

  // Set up sensors for better drag handling
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required to start drag
      },
    })
  );

  // Sort server tasks initially, memoized to prevent infinite loops
  const sortedServerTasks = useMemo(() => {
    return [...serverTasks].sort((a, b) => {
      // If both tasks have sort_order, use it (for migrated tasks)
      if (a.sort_order !== undefined && a.sort_order !== null &&
          b.sort_order !== undefined && b.sort_order !== null) {
        return a.sort_order - b.sort_order;
      }

      // Fallback to original sorting logic for non-migrated tasks
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [serverTasks]);

  // Local task order state - only used when user has manually reordered
  const [localTasks, setLocalTasks] = useState<Task[]>([]);

  // Use server tasks unless user has manually reordered
  const baseTasks = hasManualOrder ? localTasks : sortedServerTasks;

  // Apply filtering to tasks
  const filteredTasks = useMemo(() => {
    let filtered = [...baseTasks];

    // Apply search
    if (searchQuery.trim()) {
      const searchTerm = searchQuery.toLowerCase();
      filtered = filtered.filter(task =>
        task.name.toLowerCase().includes(searchTerm) ||
        (task.description && task.description.toLowerCase().includes(searchTerm))
      );
    }

    // Apply other filters
    filtered = filterTasks(filtered, selectedFilters);

    return filtered;
  }, [baseTasks, searchQuery, selectedFilters]);

  // Apply grouping to filtered tasks
  const groupedTasks = useMemo(() => {
    if (!groupBy || groupBy === 'none') {
      return [{
        key: 'all',
        label: 'All Tasks',
        tasks: filteredTasks,
        count: filteredTasks.length,
        completedCount: filteredTasks.filter(t => t.status === 'Done').length,
        sortOrder: 0
      }];
    }

    return groupTasks(filteredTasks, groupBy, allProjects, allProfiles);
  }, [filteredTasks, groupBy, allProjects, allProfiles]);

  // Final display tasks for TaskList component
  const displayTasks = filteredTasks;

  // Reset manual order when project changes
  React.useEffect(() => {
    setHasManualOrder(false);
    setLocalTasks([]);
  }, [selectedProjectIds.join(',')]);

  // Reset filters when projects change
  React.useEffect(() => {
    setSearchQuery('');
    setSelectedFilters(createEmptyFilterState());
    setGroupBy(null);
  }, [selectedProjectIds.join(',')]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = displayTasks.find((t: Task) => t.id === event.active.id);
    if (task) {
      setDraggedTask(task);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedTask(null);

    if (!over || active.id === over.id) {
      return;
    }

    const draggedTask = displayTasks.find(task => task.id === active.id);
    if (!draggedTask) {
      return;
    }

    // Check if dropping on a group header (cross-group drop)
    // Only do cross-group drop if we're NOT dropping on another task
    const droppedOnTask = displayTasks.find(task => task.id === over.id);
    if (over.data?.current?.type === 'group' && !droppedOnTask) {
      const groupKey = over.data.current.groupKey;
      const groupLabel = over.data.current.groupLabel;

      console.log('🔄 Cross-group drop:', draggedTask.name, 'to group:', groupLabel);

      // Reset manual order mode so TanStack Query updates are visible
      setHasManualOrder(false);
      setLocalTasks([]);

      // Determine what property to update based on current grouping
      let updates: any = {};

      switch (groupBy) {
        case 'project':
          updates.project_id = groupKey;
          break;
        case 'status':
          updates.status = groupKey;
          break;
        case 'assignee':
          updates.assigned_to = groupKey === 'unassigned' ? null : groupKey;
          break;
        case 'dueDate':
          // Due date grouping is more complex - we can't directly assign a date from group key
          // For now, we'll skip due date group drops
          console.warn('Due date group drops not yet supported');
          return;
        default:
          return;
      }

      // Update the task - TanStack Query will handle optimistic updates
      updateTaskMutation.mutate(
        {
          taskId: draggedTask.id,
          updates
        },
        {
          onSuccess: () => {
            console.log('✅ Task moved successfully to group:', groupLabel);
          },
          onError: (error) => {
            console.error('❌ Failed to move task:', error);
          }
        }
      );

      return;
    }

    // Regular task reordering within the same list/group
    const currentTasks = displayTasks;
    const activeIndex = currentTasks.findIndex(task => task.id === active.id);
    const overIndex = currentTasks.findIndex(task => task.id === over.id);

    if (activeIndex === -1 || overIndex === -1) {
      return;
    }

    // Apply the reorder to local state
    const reorderedTasks = arrayMove(currentTasks, activeIndex, overIndex);
    setLocalTasks(reorderedTasks);
    setHasManualOrder(true);

    console.log('🔄 Task reorder moved:', draggedTask.name, `from index ${activeIndex} to ${overIndex}`);

    // TODO: Re-enable after migration is applied
    // const beforeTaskId = overIndex > 0 ? reorderedTasks[overIndex - 1]?.id : undefined;
    // const afterTaskId = overIndex < reorderedTasks.length - 1 ? reorderedTasks[overIndex + 1]?.id : undefined;
    // moveTask(movedTask.id, beforeTaskId, afterTaskId);
  };

  // Handle project sort mode toggle
  const sortModeToggle = useToggleProjectSortMode();

  const handleToggleSortMode = (projectId: string, enabled: boolean) => {
    sortModeToggle.mutate({ projectId, enabled });
  };

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-red-500">
          <p className="text-lg font-semibold">Failed to load tasks</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex flex-col">
        {/* Quick Add Bar */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <TaskQuickAdd
            userId={userId}
            defaultProjectId={selectedProjectIds[0] || '1'}
          />
        </div>

        {/* Search/Filters Bar */}
        <TaskFiltersBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedFilters={selectedFilters}
          onFiltersChange={setSelectedFilters}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          tasks={baseTasks}
          selectedProjectIds={selectedProjectIds}
          userId={userId}
          profiles={allProfiles}
          projects={allProjects}
          totalTasks={baseTasks.length}
          filteredTasks={filteredTasks.length}
        />

        {/* Sort Mode Controls - Disabled until migration is applied */}
        {false && selectedProjectIds.length === 1 && (
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Task Ordering</span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="rounded"
                    onChange={(e) => handleToggleSortMode(selectedProjectIds[0], e.target.checked)}
                    disabled={sortModeToggle.isPending}
                  />
                  Manual Sort
                </label>
                {reorderError && (
                  <span className="text-xs text-red-500">
                    Reorder failed
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Task List */}
        <div className="flex-1 overflow-hidden">
          <TaskList
            tasks={displayTasks}
            selectedProjectIds={selectedProjectIds}
            customPropertyDefinitions={allCustomProperties}
            userId={userId}
            isLoading={isLoading}
            isDraggingActive={!!draggedTask}
            groupedTasks={groupedTasks}
            showGroupHeaders={groupBy !== null && groupBy !== 'none'}
            groupBy={groupBy}
          />
        </div>

        {/* Saved Views */}
        <div className="border-t border-gray-200 bg-white">
          <SavedViews
            userId={userId}
            selectedViewId={selectedViewId}
            onViewChange={onViewChange}
          />
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {draggedTask ? (
          <div className="bg-white border-2 border-blue-500 shadow-xl rounded-lg opacity-95 transform rotate-2">
            <TaskItem
              task={draggedTask}
              customPropertyDefinitions={allCustomProperties}
              userId={userId}
              isDragging={true}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}