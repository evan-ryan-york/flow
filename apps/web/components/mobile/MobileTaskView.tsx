'use client';

import { useState, useMemo, useEffect } from 'react';
import { Plus, Settings, NavArrowLeft, NavArrowRight } from 'iconoir-react';
import { format, addDays } from 'date-fns';
import { initializeKeyboard } from '../../lib/keyboard';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileTopActionBar } from './MobileTopActionBar';
import { MobileSearchOverlay } from './MobileSearchOverlay';
import { MobileFilterSheet } from './MobileFilterSheet';
import { MobileGroupSheet } from './MobileGroupSheet';
import { ProjectChipsBar } from './ProjectChipsBar';
import { MobileTaskDetail } from './MobileTaskDetail';
import { MobileCalendarView } from './MobileCalendarView';
import { MobileProjectsView } from './MobileProjectsView';
import { MobileAccountView } from './MobileAccountView';
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
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Create project state (for projects tab)
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Calendar state (for calendar tab)
  const [calendarView, setCalendarView] = useState<'day' | 'week'>('day');
  const [calendarDate, setCalendarDate] = useState(new Date());

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

  // Handle project visibility toggle (for ProjectChipsBar)
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

  // Handle project selection change (for MobileProjectsView)
  const handleProjectSelectionChange = (projectIds: string[]) => {
    // Update both local state and database
    onProjectSelectionChange(projectIds);
    updateVisibleProjectsMutation.mutate({ projectIds, userId });
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

  // Initialize keyboard configuration for Capacitor
  useEffect(() => {
    initializeKeyboard();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Top Action Bar - Only shown on tasks tab */}
      {activeTab === 'tasks' && (
        <MobileTopActionBar
          onSearchOpen={() => setSearchOverlayOpen(true)}
          onFilterOpen={() => setFilterSheetOpen(true)}
          onGroupOpen={() => setGroupSheetOpen(true)}
          activeFilterCount={activeFilterCount}
          currentGroupBy={groupBy}
        />
      )}

      {/* Projects Top Action Bar */}
      {activeTab === 'projects' && (
        <div className="flex items-center justify-between px-4 h-14 bg-white border-b border-gray-200">
          <h1 className="text-lg font-semibold text-blue-600">Current</h1>
          <button
            onClick={() => setIsCreatingProject(!isCreatingProject)}
            className="relative flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="Create new project"
          >
            <Plus className="w-6 h-6 text-gray-700" strokeWidth={2} style={{ transform: isCreatingProject ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease-in-out' }} />
          </button>
        </div>
      )}

      {/* Calendar Top Action Bar */}
      {activeTab === 'calendar' && (
        <div className="flex flex-col bg-white border-b border-gray-200">
          {/* First row: Title and action buttons */}
          <div className="flex items-center justify-between px-4 h-14">
            <h1 className="text-lg font-semibold text-blue-600">Current</h1>
            <div className="flex items-center gap-2">
              {/* Day/Week Toggle */}
              <div className="flex gap-1">
                <button
                  onClick={() => setCalendarView('day')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    calendarView === 'day'
                      ? 'bg-blue-100 text-blue-800'
                      : 'text-gray-600 hover:bg-gray-100 active:bg-gray-200'
                  }`}
                >
                  Day
                </button>
                <button
                  onClick={() => setCalendarView('week')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    calendarView === 'week'
                      ? 'bg-blue-100 text-blue-800'
                      : 'text-gray-600 hover:bg-gray-100 active:bg-gray-200'
                  }`}
                >
                  Week
                </button>
              </div>
              {/* Settings Button */}
              <button
                onClick={() => {
                  window.location.href = '/app/settings/calendar-connections';
                }}
                className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
                aria-label="Calendar Settings"
              >
                <Settings className="w-5 h-5 text-gray-700" strokeWidth={2} />
              </button>
            </div>
          </div>
          {/* Second row: Date navigation */}
          <div className="flex items-center justify-between px-4 pb-3">
            <button
              onClick={() => {
                const newDate = new Date(calendarDate);
                newDate.setDate(newDate.getDate() - (calendarView === 'week' ? 7 : 1));
                setCalendarDate(newDate);
              }}
              className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200"
            >
              <NavArrowLeft className="w-6 h-6 text-gray-700" strokeWidth={2.5} />
            </button>
            <span className="font-semibold text-gray-900">
              {calendarView === 'day'
                ? format(calendarDate, 'EEEE, MMM d')
                : `${format(calendarDate, 'MMM d')} - ${format(addDays(calendarDate, 6), 'MMM d')}`
              }
            </span>
            <button
              onClick={() => {
                const newDate = new Date(calendarDate);
                newDate.setDate(newDate.getDate() + (calendarView === 'week' ? 7 : 1));
                setCalendarDate(newDate);
              }}
              className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200"
            >
              <NavArrowRight className="w-6 h-6 text-gray-700" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

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

      {/* Project Chips Bar - Only shown on tasks tab */}
      {activeTab === 'tasks' && (
        <ProjectChipsBar
          projects={projects}
          visibleProjectIds={visibleProjectIds}
          selectedProjectId={selectedProjectForTasks}
          onVisibilityChange={handleVisibilityChange}
          onProjectSelect={setSelectedProjectForTasks}
          isInputFocused={isInputFocused}
        />
      )}

      {/* Main Content Area - Tab-based routing */}
      <div className="flex-1 overflow-hidden pb-20">
        {activeTab === 'tasks' && (
          <div className="h-full overflow-y-auto">
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
            {/* Spacer to ensure last task is visible above fixed add task input + bottom nav */}
            <div style={{ height: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }} />
          </div>
        )}
        {activeTab === 'projects' && (
          <MobileProjectsView
            userId={userId}
            selectedProjectIds={visibleProjectIds}
            onProjectSelectionChange={handleProjectSelectionChange}
            isCreatingProject={isCreatingProject}
            onCreateProjectToggle={() => setIsCreatingProject(!isCreatingProject)}
          />
        )}
        {activeTab === 'calendar' && (
          <MobileCalendarView
            userId={userId}
            view={calendarView}
            onViewChange={setCalendarView}
            date={calendarDate}
            onDateChange={setCalendarDate}
          />
        )}
        {activeTab === 'account' && (
          <MobileAccountView />
        )}
      </div>

      {/* Quick Add Input - Only shown on tasks tab - Fixed position above bottom nav */}
      {activeTab === 'tasks' && (
        <div
          className="fixed left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-10"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <TaskQuickAdd
            userId={userId}
            defaultProjectId={selectedProjectForTasks || visibleProjectIds[0] || ''}
            showAdvancedOptions={false}
            onFocusChange={setIsInputFocused}
          />
        </div>
      )}

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
