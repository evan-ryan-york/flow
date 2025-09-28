'use client';

import React, { useState, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  useProjectsTasks,
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

  // Filter and grouping state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<FilterState>(createEmptyFilterState());
  const [groupBy, setGroupBy] = useState<GroupByOption | null>(null);

  // Fallback to original hook until database migration is applied
  const { data: serverTasks = [], isLoading, error } = useProjectsTasks(userId, selectedProjectIds);

  // DEBUG: Check if TaskHub is rendering properly
  console.log('🔍 TaskHub RENDER:', {
    selectedProjectIds,
    userId,
    serverTasks: serverTasks.length,
    isLoading,
    error: error?.message,
    hasProjects: selectedProjectIds.length > 0
  });




  // Fetch projects and profiles data for grouping
  const { data: allProjects = [] } = useProjectsForUser(userId);
  const { data: allProfiles = [] } = useAllProfiles();


  // Create user mapping for task assignee display
  const userMapping = useMemo(() => {
    const mapping: Record<string, string> = {};
    allProfiles.forEach(profile => {
      // Use first_name if available, otherwise show "Unknown User"
      if (profile.id === userId) {
        mapping[profile.id] = 'You';
      } else {
        mapping[profile.id] = profile.first_name || profile.last_name || 'Unknown User';
      }
    });
    return mapping;
  }, [allProfiles, userId]);


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

  // Sort server tasks by due date and created date
  const sortedServerTasks = useMemo(() => {
    return [...serverTasks].sort((a, b) => {
      // Sort by due date first (tasks with due dates come first)
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;

      // Then sort by created date (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [serverTasks]);

  // Use sorted server tasks as the base
  const baseTasks = sortedServerTasks;

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
      }];
    }

    return groupTasks(filteredTasks, groupBy, allProjects, allProfiles);
  }, [filteredTasks, groupBy, allProjects, allProfiles]);

  // Final display tasks for TaskList component
  const displayTasks = filteredTasks;

  // Custom collision detection that prioritizes group drops
  const customCollisionDetection = (args: any) => {
    // First check for group collisions using rectIntersection
    const groupCollisions = rectIntersection({
      ...args,
      droppableContainers: args.droppableContainers.filter((container: any) =>
        container.id.toString().startsWith('group-')
      )
    });

    if (groupCollisions.length > 0) {
      console.log('🎯 Group collision detected:', groupCollisions[0]);
      return groupCollisions;
    }

    // Fall back to regular collision detection for task reordering
    return rectIntersection(args);
  };

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

    console.log('🔍 DRAG END DEBUG:', {
      activeId: active.id,
      overId: over?.id,
      overData: over?.data?.current,
      overType: over?.data?.current?.type,
      hasOver: !!over
    });

    if (!over || active.id === over.id) {
      console.log('🚫 Early return: no over or same id');
      return;
    }

    const draggedTask = displayTasks.find(task => task.id === active.id);
    if (!draggedTask) {
      console.log('🚫 No dragged task found');
      return;
    }

    // Check if dropping on a group (cross-group drop)
    // This handles both dropping on group headers and within group areas
    const droppedOnTask = displayTasks.find(task => task.id === over.id);
    const isGroupDrop = over.data?.current?.type === 'group';

    console.log('🔍 Drop target analysis:', {
      droppedOnTask: !!droppedOnTask,
      overType: over.data?.current?.type,
      groupKey: over.data?.current?.groupKey,
      groupBy: groupBy,
      isGroupDrop: isGroupDrop
    });

    if (isGroupDrop) {
      const groupKey = over.data.current.groupKey;
      const groupLabel = over.data.current.groupLabel;

      console.log('🔄 Cross-group drop:', draggedTask.name, 'to group:', groupLabel);

      // TanStack Query will handle updates automatically

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

    // Task reordering within the same list - currently no persistence
    console.log('🔄 Task reorder (visual only):', draggedTask.name, 'moved within list');
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
      collisionDetection={customCollisionDetection}
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
            userMapping={userMapping}
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