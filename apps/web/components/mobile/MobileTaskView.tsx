'use client';

import { useState, useMemo, useEffect } from 'react';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileTopActionBar } from './MobileTopActionBar';
import { MobileSearchOverlay } from './MobileSearchOverlay';
import { MobileFilterSheet } from './MobileFilterSheet';
import { MobileGroupSheet } from './MobileGroupSheet';
import { ProjectChipsBar } from './ProjectChipsBar';
import { MobileTaskDetail } from './MobileTaskDetail';
import { TaskList } from '../TaskList';
import { TaskQuickAdd } from '../TaskQuickAdd';
import {
  useProjectsForUser,
  useVisibleProjectIds,
  useUpdateVisibleProjectIds,
  useProjectsTasks,
  useAllProfiles,
  useProjectDefinitions,
  useTasksPropertyValues,
} from '@perfect-task-app/data';
import { GroupByOption, groupTasks } from '@perfect-task-app/ui/lib/taskGrouping';
import { FilterState, createEmptyFilterState, getActiveFilterCount, getAvailableFilters, filterTasks } from '@perfect-task-app/ui/lib/taskFiltering';

interface MobileTaskViewProps {
  userId: string;
  selectedProjectIds: string[];
  onProjectSelectionChange: (ids: string[]) => void;
}

export function MobileTaskView({
  userId,
  selectedProjectIds: _selectedProjectIds,
  onProjectSelectionChange,
}: MobileTaskViewProps) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'projects' | 'calendar' | 'account'>('tasks');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false);

  // Filter & Group state
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<FilterState>(createEmptyFilterState());
  const [groupBy, setGroupBy] = useState<GroupByOption | null>(null);

  // Task detail state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);

  // Selected project for new tasks (long-press on project chip)
  const [selectedProjectForTasks, setSelectedProjectForTasks] = useState<string | null>(null);

  // Fetch user projects and visibility state
  const { data: projects = [] } = useProjectsForUser(userId);
  const { data: visibleProjectIds = [] } = useVisibleProjectIds(userId);
  const updateVisibleProjectsMutation = useUpdateVisibleProjectIds();

  // Fetch tasks for visible projects
  const { data: tasks = [] } = useProjectsTasks(userId, visibleProjectIds);

  // Fetch profiles for assignee filtering
  const { data: allProfiles = [] } = useAllProfiles();

  // Fetch custom property definitions for the first visible project (simplified for mobile)
  const firstProjectId = visibleProjectIds[0] || '';
  const { data: customPropertyDefinitions = [] } = useProjectDefinitions(firstProjectId);

  // Calculate active filter count
  const activeFilterCount = getActiveFilterCount(selectedFilters);

  // Generate available filter options
  const availableFilters = useMemo(() => {
    const filters = getAvailableFilters(tasks, allProfiles);
    // Enhance project options with actual project names
    const enhancedFilters = {
      ...filters,
      completionTimeframe: filters.completionTimeframe || []
    };
    enhancedFilters.project = enhancedFilters.project.map(option => ({
      ...option,
      label: projects.find(p => p.id === option.value)?.name || option.label
    }));
    return enhancedFilters;
  }, [tasks, allProfiles, projects]);

  // Apply filtering and grouping to tasks (similar to TaskHub pattern)
  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    // Apply search
    if (searchQuery.trim()) {
      const searchTerm = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (task) =>
          task.name.toLowerCase().includes(searchTerm) ||
          (task.description && task.description.toLowerCase().includes(searchTerm)),
      );
    }

    // Apply filters (with default completion filter to hide completed tasks)
    const effectiveFilters = {
      ...selectedFilters,
      completion: selectedFilters.completion || { status: 'incomplete' as const }
    };
    filtered = filterTasks(filtered, effectiveFilters);

    return filtered;
  }, [tasks, searchQuery, selectedFilters]);

  // Fetch all custom property values for grouping support
  const taskIds = useMemo(() => filteredTasks.map(t => t.id), [filteredTasks]);
  const { data: allPropertyValues = [] } = useTasksPropertyValues(taskIds);

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
    let customPropDef;
    if (typeof groupBy === 'object' && groupBy.type === 'customProperty') {
      customPropDef = customPropertyDefinitions.find(p => p.id === groupBy.definitionId);
    }

    return groupTasks(
      filteredTasks,
      groupBy,
      projects,
      allProfiles,
      customPropDef,
      allPropertyValues
    );
  }, [filteredTasks, groupBy, projects, allProfiles, customPropertyDefinitions, allPropertyValues]);

  // Create user mapping for task assignee display
  const userMapping = useMemo(() => {
    const mapping: Record<string, string> = {};
    allProfiles.forEach((profile) => {
      if (profile.id === userId) {
        mapping[profile.id] = "You";
      } else {
        mapping[profile.id] = profile.first_name || profile.last_name || "Unknown User";
      }
    });
    return mapping;
  }, [allProfiles, userId]);

  // Create project mapping for task project display
  const projectMapping = useMemo(() => {
    const mapping: Record<string, string> = {};
    projects.forEach((project) => {
      mapping[project.id] = project.name;
    });
    return mapping;
  }, [projects]);

  // Handle project visibility toggle
  const handleVisibilityChange = (projectId: string, visible: boolean) => {
    let newVisibleIds: string[];
    if (visible) {
      newVisibleIds = [...visibleProjectIds, projectId];
    } else {
      newVisibleIds = visibleProjectIds.filter(id => id !== projectId);
    }

    // Update both local state and database
    onProjectSelectionChange(newVisibleIds);
    updateVisibleProjectsMutation.mutate({ projectIds: newVisibleIds, userId });
  };

  // Handle task click to open detail overlay
  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
    setTaskDetailOpen(true);
  };

  // Handle task detail close
  const handleTaskDetailClose = () => {
    setTaskDetailOpen(false);
    // Small delay before clearing taskId to allow closing animation
    setTimeout(() => setSelectedTaskId(null), 300);
  };

  // Initialize selected project to first visible project
  useEffect(() => {
    if (!selectedProjectForTasks && visibleProjectIds.length > 0) {
      setSelectedProjectForTasks(visibleProjectIds[0]);
    }
  }, [visibleProjectIds, selectedProjectForTasks]);

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Top Action Bar */}
      <MobileTopActionBar
        onSearchOpen={() => setSearchOverlayOpen(true)}
        onFilterOpen={() => setFilterSheetOpen(true)}
        onGroupOpen={() => setGroupSheetOpen(true)}
        activeFilterCount={activeFilterCount}
        currentGroupBy={groupBy}
      />

      {/* Search Overlay */}
      <MobileSearchOverlay
        isOpen={searchOverlayOpen}
        onClose={() => setSearchOverlayOpen(false)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalTasks={tasks.length}
        filteredTasks={filteredTasks.length}
      />

      {/* Filter Sheet */}
      <MobileFilterSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        availableFilters={availableFilters}
        selectedFilters={selectedFilters}
        onChange={setSelectedFilters}
      />

      {/* Group Sheet */}
      <MobileGroupSheet
        isOpen={groupSheetOpen}
        onClose={() => setGroupSheetOpen(false)}
        value={groupBy}
        onChange={setGroupBy}
        tasks={tasks}
        selectedProjectIds={visibleProjectIds}
        customPropertyDefinitions={customPropertyDefinitions}
      />

      {/* Project Chips Bar */}
      <ProjectChipsBar
        projects={projects}
        visibleProjectIds={visibleProjectIds}
        selectedProjectId={selectedProjectForTasks}
        onVisibilityChange={handleVisibilityChange}
        onProjectSelect={setSelectedProjectForTasks}
      />

      {/* Main Content Area - Tab-based routing */}
      <div className="flex-1 overflow-hidden pb-20">
        {activeTab === 'tasks' && (
          <TaskList
            tasks={filteredTasks}
            selectedProjectIds={visibleProjectIds}
            customPropertyDefinitions={customPropertyDefinitions}
            userId={userId}
            isLoading={false}
            isDraggingActive={false}
            groupedTasks={groupedTasks}
            showGroupHeaders={groupBy !== null && groupBy !== "none"}
            groupBy={groupBy}
            userMapping={userMapping}
            projectMapping={projectMapping}
            projects={projects}
            profiles={allProfiles}
            customPropertyValues={allPropertyValues}
            onTaskEditClick={handleTaskClick}
          />
        )}
        {activeTab === 'projects' && (
          <div className="p-4">
            <p className="text-gray-500 text-center">Project management will appear here</p>
            <p className="text-xs text-gray-400 text-center mt-2">Future feature</p>
          </div>
        )}
        {activeTab === 'calendar' && (
          <div className="p-4">
            <p className="text-gray-500 text-center">Calendar view will appear here</p>
            <p className="text-xs text-gray-400 text-center mt-2">Desktop calendar adapted for mobile</p>
          </div>
        )}
        {activeTab === 'account' && (
          <div className="p-4">
            <p className="text-gray-500 text-center">Account settings will appear here</p>
            <p className="text-xs text-gray-400 text-center mt-2">Future feature</p>
          </div>
        )}
      </div>

      {/* Quick Add Input - Integrated TaskQuickAdd */}
      <div className="sticky bottom-16 bg-white border-t border-gray-200 p-4 shadow-lg">
        <TaskQuickAdd
          userId={userId}
          defaultProjectId={selectedProjectForTasks || visibleProjectIds[0] || ''}
          showAdvancedOptions={false}
        />
      </div>

      {/* Bottom Navigation */}
      <MobileBottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Task Detail Overlay */}
      <MobileTaskDetail
        taskId={selectedTaskId}
        isOpen={taskDetailOpen}
        onClose={handleTaskDetailClose}
        userId={userId}
      />
    </div>
  );
}
