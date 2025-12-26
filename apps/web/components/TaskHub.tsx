"use client";

import React, { useState, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  rectIntersection,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  useProjectsTasks,
  useRealtimeTaskSync,
  useProjectDefinitions,
  useProjectsForUser,
  useAllProfiles,
  useUpdateTask,
  useTaskEditPanel,
  useTasksPropertyValues,
  useSetPropertyValue,
  useUserViews,
  useBulkUpdateTasks,
  useBulkDeleteTasks,
} from "@flow-app/data";
import { useQueryClient } from "@tanstack/react-query";
import { TaskQuickAdd } from "./TaskQuickAdd";
import { TaskList } from "./TaskList";
import { KanbanView } from "./KanbanView";
import { SavedViews } from "./SavedViews";
import { TaskItem } from "./TaskItem";
import { TaskFiltersBar } from "./TaskFiltersBar";
import { BatchActionBar } from "./BatchActionBar";
import { BatchProjectSelectorDialog } from "./BatchProjectSelectorDialog";
import { BatchDueDateDialog } from "./BatchDueDateDialog";
import { BatchOwnerSelectorDialog } from "./BatchOwnerSelectorDialog";
import { TaskEditPullover } from "./TaskEditPullover";
import { CreateViewDialog } from "./CreateViewDialog";
import { Task, CustomPropertyDefinition } from "@flow-app/models";
import { FilterState, createEmptyFilterState, filterTasks } from "@flow-app/ui/lib/taskFiltering";
import { GroupByOption, groupTasks } from "@flow-app/ui/lib/taskGrouping";

interface TaskHubProps {
  userId: string;
  selectedProjectIds: string[];
  projectForTaskCreation?: string;
  selectedViewId: string | null;
  onViewChange: (viewId: string | null) => void;
  onProjectSelectionChange?: (projectIds: string[]) => void;
}

export function TaskHub({ userId, selectedProjectIds, projectForTaskCreation, selectedViewId, onViewChange, onProjectSelectionChange }: TaskHubProps) {
  console.log('🟡 [TaskHub] Rendered with projectForTaskCreation:', projectForTaskCreation);

  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  // Track tasks that are currently completing (to show them for 2 seconds)
  const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(new Set());

  // View dialog state
  const [isCreateViewDialogOpen, setIsCreateViewDialogOpen] = useState(false);

  // Batch actions state
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Batch dialog states
  const [isProjectSelectorOpen, setIsProjectSelectorOpen] = useState(false);
  const [isDueDateDialogOpen, setIsDueDateDialogOpen] = useState(false);
  const [isOwnerSelectorOpen, setIsOwnerSelectorOpen] = useState(false);

  // Fetch all views for user and the active view
  const { data: userViews = [] } = useUserViews(userId);
  const activeView = userViews.find(v => v.id === selectedViewId);

  // Filter and grouping state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<FilterState>(createEmptyFilterState());
  const [groupBy, setGroupBy] = useState<GroupByOption | null>(null);

  // Column visibility state
  const [visibleColumnIds, setVisibleColumnIds] = useState<Set<string>>(() => new Set());
  const [visibleBuiltInColumns, setVisibleBuiltInColumns] = useState<Set<'assigned_to' | 'due_date' | 'project' | 'created_at'>>(() =>
    new Set(['assigned_to', 'due_date', 'project', 'created_at'])
  );

  // Task edit panel state
  const {
    isOpen: isEditPanelOpen,
    selectedTaskId,
    openPanel: openEditPanel,
    closePanel: closeEditPanel,
    switchTask: switchEditTask,
    hasUnsavedChanges,
    setHasUnsavedChanges,
  } = useTaskEditPanel();

  // Always use selectedProjectIds for fetching tasks - views only initialize the selection
  // The parent component (ThreeColumnLayout) manages syncing selectedProjectIds with view changes
  const effectiveProjectIds = selectedProjectIds;

  // Fetch tasks from effective project IDs
  // When no projects are selected, the query is disabled and we explicitly use an empty array
  const { data: serverTasks = [], isLoading, error } = useProjectsTasks(userId, effectiveProjectIds);
  const actualServerTasks = useMemo(() =>
    effectiveProjectIds.length === 0 ? [] : serverTasks,
    [effectiveProjectIds.length, serverTasks]
  );

  // Use isFetching instead of isLoading to prevent showing loader when we already have data
  // isLoading is true when there's no cached data, isFetching is true during any fetch
  // We only want to show the loader when we have no data at all
  const hasNoProjects = effectiveProjectIds.length === 0;
  const effectiveIsLoading = hasNoProjects ? false : (isLoading && !actualServerTasks.length);

  // Fetch projects and profiles data for grouping
  const { data: allProjects = [] } = useProjectsForUser(userId);
  const { data: allProfiles = [] } = useAllProfiles();

  // Create user mapping for task assignee display
  const userMapping = useMemo(() => {
    const mapping: Record<string, string> = {};
    allProfiles.forEach((profile) => {
      // Use first_name, last_name, or full_name
      if (profile.id === userId) {
        mapping[profile.id] = "You";
      } else {
        const fullName = profile.first_name && profile.last_name
          ? `${profile.first_name} ${profile.last_name}`.trim()
          : profile.first_name || profile.last_name || profile.full_name || "Unknown User";
        mapping[profile.id] = fullName;
      }
    });
    return mapping;
  }, [allProfiles, userId]);

  // Create project mapping for task project display
  const projectMapping = useMemo(() => {
    const mapping: Record<string, string> = {};
    allProjects.forEach((project) => {
      mapping[project.id] = project.name;
    });
    return mapping;
  }, [allProjects]);

  // Task update hook for cross-group drops
  const updateTaskMutation = useUpdateTask();
  const setPropertyValueMutation = useSetPropertyValue();
  const bulkUpdateTasksMutation = useBulkUpdateTasks();
  const bulkDeleteTasksMutation = useBulkDeleteTasks();
  const queryClient = useQueryClient();

  // Real-time synchronization
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isConnected } = useRealtimeTaskSync(userId, selectedProjectIds);

  // Listen for task completions to delay hiding them
  React.useEffect(() => {
    const handleTaskComplete = (event: Event) => {
      const customEvent = event as CustomEvent<{ taskId: string }>;
      const taskId = customEvent.detail.taskId;
      setCompletingTaskIds(prev => new Set(prev).add(taskId));

      // Remove from completing set after 2 seconds
      setTimeout(() => {
        setCompletingTaskIds(prev => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }, 2000);
    };

    window.addEventListener('task-completed', handleTaskComplete);
    return () => window.removeEventListener('task-completed', handleTaskComplete);
  }, []);

  // Get custom property definitions for all selected projects
  // We need to call hooks for a fixed maximum number of projects to follow Rules of Hooks
  const project1Definitions = useProjectDefinitions(selectedProjectIds[0] || "");
  const project2Definitions = useProjectDefinitions(selectedProjectIds[1] || "");
  const project3Definitions = useProjectDefinitions(selectedProjectIds[2] || "");
  const project4Definitions = useProjectDefinitions(selectedProjectIds[3] || "");
  const project5Definitions = useProjectDefinitions(selectedProjectIds[4] || "");

  const allCustomProperties = useMemo(() => {
    const definitionMap = new Map<string, CustomPropertyDefinition>();

    // Collect definitions from all active project queries
    const queries = [
      project1Definitions,
      project2Definitions,
      project3Definitions,
      project4Definitions,
      project5Definitions,
    ].slice(0, selectedProjectIds.length);

    queries.forEach((query) => {
      if (query.data) {
        query.data.forEach((definition) => {
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
    project1Definitions,
    project2Definitions,
    project3Definitions,
    project4Definitions,
    project5Definitions,
    selectedProjectIds.length,
  ]);

  // Set up sensors for better drag handling
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required to start drag
      },
    }),
  );

  // Sort server tasks based on view config or default sorting
  const sortedServerTasks = useMemo(() => {
    const sortBy = activeView?.config.sortBy || 'due_date';

    return [...actualServerTasks].sort((a, b) => {
      switch (sortBy) {
        case 'due_date':
          // Sort by due date first (tasks with due dates come first)
          if (a.due_date && b.due_date) {
            return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          }
          if (a.due_date && !b.due_date) return -1;
          if (!a.due_date && b.due_date) return 1;
          // Fall through to created_at for tasks without due dates
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

        case 'created_at':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

        case 'name':
          return a.name.localeCompare(b.name);

        case 'completion':
          // Sort by completion status (incomplete first, then completed)
          if (a.is_completed === b.is_completed) return 0;
          return a.is_completed ? 1 : -1;

        default:
          // Default to due date sorting
          if (a.due_date && b.due_date) {
            return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          }
          if (a.due_date && !b.due_date) return -1;
          if (!a.due_date && b.due_date) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [actualServerTasks, activeView?.config.sortBy]);

  // Use sorted server tasks as the base
  const baseTasks = sortedServerTasks;

  // Fetch all custom property values for grouping support
  const taskIds = useMemo(() => baseTasks.map(t => t.id), [baseTasks]);
  const { data: allPropertyValues = [] } = useTasksPropertyValues(taskIds);

  // Apply filtering to tasks
  const filteredTasks = useMemo(() => {
    let filtered = [...baseTasks];

    // By default, hide completed tasks unless a completion filter is active
    // Set default completion filter to 'incomplete' if none is set
    const effectiveFilters = {
      ...selectedFilters,
      completion: selectedFilters.completion || { status: 'incomplete' as const }
    };

    // BUT keep tasks that are currently completing visible for 2 seconds
    const tasksWithCompletingVisible = filtered.map(task => {
      if (completingTaskIds.has(task.id)) {
        // Temporarily show completing tasks even if they would be filtered out
        return task;
      }
      return task;
    });

    // Apply search
    if (searchQuery.trim()) {
      const searchTerm = searchQuery.toLowerCase();
      filtered = tasksWithCompletingVisible.filter(
        (task) =>
          task.name.toLowerCase().includes(searchTerm) ||
          (task.description && task.description.toLowerCase().includes(searchTerm)),
      );
    } else {
      filtered = tasksWithCompletingVisible;
    }

    // Apply other filters (including the effective completion filter)
    filtered = filterTasks(filtered, effectiveFilters);

    // Re-add completing tasks if they were filtered out
    const completingTasks = baseTasks.filter(task =>
      completingTaskIds.has(task.id) && !filtered.some(t => t.id === task.id)
    );

    return [...filtered, ...completingTasks];
  }, [baseTasks, searchQuery, selectedFilters, completingTaskIds]);

  // Apply grouping to filtered tasks
  const groupedTasks = useMemo(() => {
    if (!groupBy || groupBy === "none") {
      return [
        {
          key: "all",
          label: "All Tasks",
          tasks: filteredTasks,
          count: filteredTasks.length,
          completedCount: filteredTasks.filter((t) => t.is_completed).length,
          sortOrder: 0,
        },
      ];
    }

    // Determine custom property definition if needed
    let customPropDef: CustomPropertyDefinition | undefined;
    if (typeof groupBy === 'object' && groupBy.type === 'customProperty') {
      customPropDef = allCustomProperties.find(p => p.id === groupBy.definitionId);
    }

    return groupTasks(
      filteredTasks,
      groupBy,
      allProjects,
      allProfiles,
      customPropDef,
      allPropertyValues
    );
  }, [filteredTasks, groupBy, allProjects, allProfiles, allCustomProperties, allPropertyValues]);

  // Final display tasks for TaskList component
  const displayTasks = filteredTasks;

  // Custom collision detection that prioritizes group drops
  const customCollisionDetection = (args: Parameters<typeof rectIntersection>[0]) => {
    // First check for group collisions using rectIntersection
    const groupCollisions = rectIntersection({
      ...args,
      droppableContainers: args.droppableContainers.filter((container) =>
        container.id.toString().startsWith("group-"),
      ),
    });

    if (groupCollisions.length > 0) {
      return groupCollisions;
    }

    // Fall back to regular collision detection for task reordering
    return rectIntersection(args);
  };

  // Initialize visibleColumnIds when custom properties load
  React.useEffect(() => {
    if (allCustomProperties.length > 0 && visibleColumnIds.size === 0) {
      // Initialize with all custom properties visible
      setVisibleColumnIds(new Set(allCustomProperties.map(p => p.id)));
    }
  }, [allCustomProperties, visibleColumnIds.size]);

  // Sync groupBy and column visibility with active view config
  React.useEffect(() => {
    if (!activeView) {
      return;
    }

    console.log('🔄 [VIEW SWITCH] Switching to view:', activeView.name, {
      visibleProperties: activeView.config.visibleProperties,
      visibleBuiltInColumns: activeView.config.visibleBuiltInColumns,
    });

    // Sync groupBy
    if (activeView.config.groupBy) {
      setGroupBy(activeView.config.groupBy as GroupByOption);
    } else {
      setGroupBy(null);
    }

    // Sync visible custom property columns
    if (activeView.config.visibleProperties) {
      setVisibleColumnIds(new Set(activeView.config.visibleProperties));
    }

    // Sync visible built-in columns
    if (activeView.config.visibleBuiltInColumns) {
      setVisibleBuiltInColumns(new Set(activeView.config.visibleBuiltInColumns));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView?.id]);

  // Reset filters when projects change (but not when view changes)
  React.useEffect(() => {
    if (!activeView) {
      setSearchQuery("");
      setSelectedFilters(createEmptyFilterState());
      setGroupBy(null);
    }
  }, [selectedProjectIds, activeView]);


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

    const draggedTask = displayTasks.find((task) => task.id === active.id);
    if (!draggedTask) {
      return;
    }

    // Check if dropping on a group (cross-group drop)
    // This handles both dropping on group headers and within group areas
    const isGroupDrop = over.data?.current?.type === "group";

    if (isGroupDrop) {
      const groupKey = over.data.current?.groupKey;

      // Check if grouping by custom property
      if (groupBy && typeof groupBy === 'object' && groupBy.type === 'customProperty') {
        // Update custom property value
        setPropertyValueMutation.mutate(
          {
            taskId: draggedTask.id,
            definitionId: groupBy.definitionId,
            value: groupKey === '(No Value)' ? '' : groupKey,
            userId,
          }
        );
        return;
      }

      // TanStack Query will handle updates automatically

      // Determine what property to update based on current grouping
      const updates: Record<string, string | boolean | null> = {};

      switch (groupBy) {
        case "project":
          updates.project_id = groupKey;
          break;
        case "completion":
          updates.is_completed = groupKey === "completed";
          updates.completed_at = groupKey === "completed" ? new Date().toISOString() : null;
          break;
        case "assignee":
          updates.assigned_to = groupKey === "unassigned" ? null : groupKey;
          break;
        case "dueDate":
          // Due date grouping is more complex - we can't directly assign a date from group key
          // For now, we'll skip due date group drops
          return;
        default:
          return;
      }

      // Update the task - TanStack Query will handle optimistic updates
      updateTaskMutation.mutate(
        {
          taskId: draggedTask.id,
          updates,
        }
      );

      return;
    }

    // Task reordering within the same list - currently no persistence
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

  // Batch mode handlers
  const handleBatchModeToggle = () => {
    setIsBatchMode(!isBatchMode);
    // Clear selection when toggling batch mode off
    if (isBatchMode) {
      setSelectedTaskIds(new Set());
    }
  };

  const handleTaskSelectionToggle = (taskId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedTaskIds(new Set());
  };

  // Batch action handlers
  const handleBatchMarkComplete = () => {
    const taskIds = Array.from(selectedTaskIds);
    bulkUpdateTasksMutation.mutate(
      {
        taskIds,
        updates: {
          is_completed: true,
          completed_at: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          // Clear selection after successful update
          setSelectedTaskIds(new Set());
        },
      }
    );
  };

  const handleBatchMarkIncomplete = () => {
    const taskIds = Array.from(selectedTaskIds);
    bulkUpdateTasksMutation.mutate(
      {
        taskIds,
        updates: {
          is_completed: false,
          completed_at: null,
        },
      },
      {
        onSuccess: () => {
          // Clear selection after successful update
          setSelectedTaskIds(new Set());
        },
      }
    );
  };

  const handleBatchSetProject = () => {
    setIsProjectSelectorOpen(true);
  };

  const handleBatchSetProjectConfirm = (projectId: string) => {
    const taskIds = Array.from(selectedTaskIds);

    // Check if the target project is not currently visible
    if (!selectedProjectIds.includes(projectId) && onProjectSelectionChange) {
      // Add the project to visible projects
      const newProjectIds = [...selectedProjectIds, projectId];
      onProjectSelectionChange(newProjectIds);
    }

    bulkUpdateTasksMutation.mutate(
      {
        taskIds,
        updates: { project_id: projectId },
      },
      {
        onSuccess: () => {
          setSelectedTaskIds(new Set());
        },
      }
    );
  };

  const handleBatchSetDueDate = () => {
    setIsDueDateDialogOpen(true);
  };

  const handleBatchSetDueDateConfirm = (dueDate: string) => {
    const taskIds = Array.from(selectedTaskIds);
    bulkUpdateTasksMutation.mutate(
      {
        taskIds,
        updates: { due_date: dueDate || undefined },
      },
      {
        onSuccess: () => {
          setSelectedTaskIds(new Set());
        },
      }
    );
  };

  const handleBatchSetOwner = () => {
    setIsOwnerSelectorOpen(true);
  };

  const handleBatchSetOwnerConfirm = (ownerId: string) => {
    const taskIds = Array.from(selectedTaskIds);
    bulkUpdateTasksMutation.mutate(
      {
        taskIds,
        updates: { assigned_to: ownerId || undefined },
      },
      {
        onSuccess: () => {
          setSelectedTaskIds(new Set());
        },
      }
    );
  };

  const handleBatchDelete = () => {
    // Simple confirmation using browser confirm for now
    const taskIds = Array.from(selectedTaskIds);
    const taskCount = taskIds.length;
    const taskLabel = taskCount === 1 ? 'task' : 'tasks';

    if (window.confirm(`Are you sure you want to delete ${taskCount} ${taskLabel}? This action cannot be undone.`)) {
      bulkDeleteTasksMutation.mutate(taskIds, {
        onSuccess: () => {
          // Clear selection and exit batch mode after successful delete
          setSelectedTaskIds(new Set());
        },
      });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex flex-col">
        {/* Quick Add Bar */}
        <div className="h-[57px] px-4 border-b border-gray-200 bg-white flex items-center w-full">
          <div className="w-full">
            <TaskQuickAdd
              userId={userId}
              defaultProjectId={selectedProjectIds[0] || "1"}
              externalProjectId={projectForTaskCreation}
            />
          </div>
        </div>

        {/* Search/Filters Bar */}
        <TaskFiltersBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedFilters={selectedFilters}
          onFiltersChange={setSelectedFilters}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          isBatchMode={isBatchMode}
          onBatchModeToggle={handleBatchModeToggle}
          tasks={baseTasks}
          selectedProjectIds={selectedProjectIds}
          profiles={allProfiles}
          projects={allProjects}
          customPropertyDefinitions={allCustomProperties}
          totalTasks={baseTasks.length}
          filteredTasks={filteredTasks.length}
        />

        {/* Batch Action Bar - Shows when in batch mode */}
        <BatchActionBar
          isBatchMode={isBatchMode}
          selectedTaskIds={selectedTaskIds}
          onMarkComplete={handleBatchMarkComplete}
          onMarkIncomplete={handleBatchMarkIncomplete}
          onSetProject={handleBatchSetProject}
          onSetDueDate={handleBatchSetDueDate}
          onSetOwner={handleBatchSetOwner}
          onDelete={handleBatchDelete}
          onClearSelection={handleClearSelection}
          profiles={allProfiles}
          projects={allProjects}
        />

        {/* Task List or Kanban View */}
        <div className="flex-1 overflow-hidden">
          {activeView?.type === 'kanban' ? (
            <KanbanView
              tasks={displayTasks}
              userId={userId}
              projects={allProjects}
              profiles={allProfiles}
              customPropertyDefinitions={allCustomProperties}
            />
          ) : (
            <TaskList
              tasks={displayTasks}
              selectedProjectIds={selectedProjectIds}
              customPropertyDefinitions={allCustomProperties}
              userId={userId}
              isLoading={effectiveIsLoading}
              isDraggingActive={!!draggedTask}
              groupedTasks={groupedTasks}
              showGroupHeaders={groupBy !== null && groupBy !== "none"}
              groupBy={groupBy}
              userMapping={userMapping}
              projectMapping={projectMapping}
              projects={allProjects}
              profiles={allProfiles}
              visibleColumnIds={visibleColumnIds}
              visibleBuiltInColumns={visibleBuiltInColumns}
              onVisibleColumnIdsChange={setVisibleColumnIds}
              onVisibleBuiltInColumnsChange={setVisibleBuiltInColumns}
              customPropertyValues={allPropertyValues}
              isBatchMode={isBatchMode}
              selectedTaskIds={selectedTaskIds}
              onTaskSelectionToggle={handleTaskSelectionToggle}
              onTaskEditClick={(taskId) => {
                if (isEditPanelOpen && selectedTaskId === taskId) {
                  // If same task is clicked, close the panel
                  closeEditPanel();
                } else if (isEditPanelOpen) {
                  // If panel is open but different task, switch task
                  // Pre-populate the cache with the task data from the list
                  const taskData = displayTasks.find((t) => t.id === taskId);
                  if (taskData) {
                    queryClient.setQueryData(['tasks', 'task', taskId], taskData);
                  }
                  switchEditTask(taskId);
                } else {
                  // Pre-populate the cache with the task data from the list
                  const taskData = displayTasks.find((t) => t.id === taskId);
                  if (taskData) {
                    queryClient.setQueryData(['tasks', 'task', taskId], taskData);
                  }
                  // Open panel with new task
                  openEditPanel(taskId);
                }
              }}
            />
          )}
        </div>

        {/* Saved Views */}
        <div className="border-t border-gray-200 bg-white">
          <SavedViews
            userId={userId}
            selectedViewId={selectedViewId}
            onViewChange={onViewChange}
            onCreateView={() => setIsCreateViewDialogOpen(true)}
          />
        </div>
      </div>

      {/* Create View Dialog */}
      <CreateViewDialog
        isOpen={isCreateViewDialogOpen}
        onClose={() => setIsCreateViewDialogOpen(false)}
        userId={userId}
        currentProjectIds={selectedProjectIds}
        currentGroupBy={typeof groupBy === 'string' ? groupBy : undefined}
        currentSortBy={activeView?.config.sortBy || 'due_date'}
        currentViewType={activeView?.type || 'list'}
        currentVisibleProperties={Array.from(visibleColumnIds)}
        currentVisibleBuiltInColumns={Array.from(visibleBuiltInColumns)}
        onViewCreated={(viewId) => {
          // Switch to the newly created view
          onViewChange(viewId);
        }}
      />

      {/* Batch Action Dialogs */}
      <BatchProjectSelectorDialog
        isOpen={isProjectSelectorOpen}
        onClose={() => setIsProjectSelectorOpen(false)}
        onConfirm={handleBatchSetProjectConfirm}
        projects={allProjects}
        selectedTaskCount={selectedTaskIds.size}
      />

      <BatchDueDateDialog
        isOpen={isDueDateDialogOpen}
        onClose={() => setIsDueDateDialogOpen(false)}
        onConfirm={handleBatchSetDueDateConfirm}
        selectedTaskCount={selectedTaskIds.size}
      />

      <BatchOwnerSelectorDialog
        isOpen={isOwnerSelectorOpen}
        onClose={() => setIsOwnerSelectorOpen(false)}
        onConfirm={handleBatchSetOwnerConfirm}
        profiles={allProfiles}
        currentUserId={userId}
        selectedTaskCount={selectedTaskIds.size}
      />


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

      {/* Task Edit Pullover */}
      <TaskEditPullover
        taskId={selectedTaskId}
        isOpen={isEditPanelOpen}
        onClose={closeEditPanel}
        userId={userId}
        hasUnsavedChanges={hasUnsavedChanges}
        setHasUnsavedChanges={setHasUnsavedChanges}
      />
    </DndContext>
  );
}
