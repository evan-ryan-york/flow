'use client';

import React, { useMemo } from 'react';
import { Task, CustomPropertyDefinition } from '@perfect-task-app/models';
import { FilterState, getAvailableFilters } from '@perfect-task-app/ui/lib/taskFiltering';
import { GroupByOption } from '@perfect-task-app/ui/lib/taskGrouping';
import { TaskSearchInput } from './filters/TaskSearchInput';
import { ColumnFilterDropdown } from './filters/ColumnFilterDropdown';
import { GroupByDropdown } from './filters/GroupByDropdown';
import { ActiveFiltersBar } from './filters/ActiveFiltersBar';

interface TaskFiltersBarProps {
  // Search functionality
  searchQuery: string;
  onSearchChange: (query: string) => void;

  // Filter functionality
  selectedFilters: FilterState;
  onFiltersChange: (filters: FilterState) => void;

  // Grouping functionality
  groupBy: GroupByOption | null;
  onGroupByChange: (groupBy: GroupByOption | null) => void;

  // Data for filter options
  tasks: Task[];
  selectedProjectIds: string[];
  userId: string;
  profiles?: any[];
  projects?: any[];
  customPropertyDefinitions?: CustomPropertyDefinition[];

  // Task counts for feedback
  totalTasks: number;
  filteredTasks: number;
}

export function TaskFiltersBar({
  searchQuery,
  onSearchChange,
  selectedFilters,
  onFiltersChange,
  groupBy,
  onGroupByChange,
  tasks,
  selectedProjectIds,
  userId,
  profiles = [],
  projects = [],
  customPropertyDefinitions = [],
  totalTasks,
  filteredTasks
}: TaskFiltersBarProps) {

  // Generate available filter options based on current tasks
  const availableFilters = useMemo(() => {
    return getAvailableFilters(tasks, profiles);
  }, [tasks, profiles]);

  // Enhanced project filter options with actual project names
  const enhancedAvailableFilters = useMemo(() => {
    const enhanced = { ...availableFilters };

    // Enhance project options with actual project names
    enhanced.project = enhanced.project.map(option => ({
      ...option,
      label: projects.find(p => p.id === option.value)?.name || option.label
    }));

    return enhanced;
  }, [availableFilters, projects]);

  // Clear handlers for ActiveFiltersBar
  const handleSearchClear = () => {
    onSearchChange('');
  };

  const handleFilterClear = (filterType: keyof FilterState) => {
    const clearedFilters = { ...selectedFilters };

    switch (filterType) {
      case 'status':
        clearedFilters.status = [];
        break;
      case 'assignee':
        clearedFilters.assignee = [];
        break;
      case 'dueDate':
        clearedFilters.dueDate = null;
        break;
      case 'project':
        clearedFilters.project = [];
        break;
      case 'customProperties':
        clearedFilters.customProperties = {};
        break;
    }

    onFiltersChange(clearedFilters);
  };

  const handleGroupByClear = () => {
    onGroupByChange(null);
  };

  const handleClearAll = () => {
    onSearchChange('');
    onFiltersChange({
      search: '',
      status: [],
      assignee: [],
      dueDate: null,
      project: [],
      customProperties: {}
    });
    onGroupByChange(null);
  };

  // Show the filters bar only if there are tasks or active filters
  const shouldShowFiltersBar = totalTasks > 0;

  if (!shouldShowFiltersBar) {
    return null;
  }

  return (
    <div className="bg-white">
      {/* Main filters row */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Search */}
          <div className="flex-1 max-w-md">
            <TaskSearchInput
              value={searchQuery}
              onChange={onSearchChange}
              totalTasks={totalTasks}
              filteredTasks={filteredTasks}
            />
          </div>

          {/* Right: Filter Controls */}
          <div className="flex items-center gap-2">
            <ColumnFilterDropdown
              availableFilters={enhancedAvailableFilters}
              selectedFilters={selectedFilters}
              onChange={onFiltersChange}
            />

            <GroupByDropdown
              value={groupBy}
              onChange={onGroupByChange}
              tasks={tasks}
              selectedProjectIds={selectedProjectIds}
              customPropertyDefinitions={customPropertyDefinitions}
            />
          </div>
        </div>
      </div>

      {/* Active filters bar */}
      <ActiveFiltersBar
        searchQuery={searchQuery}
        selectedFilters={selectedFilters}
        groupBy={groupBy}
        totalTasks={totalTasks}
        filteredTasks={filteredTasks}
        onSearchClear={handleSearchClear}
        onFilterClear={handleFilterClear}
        onGroupByClear={handleGroupByClear}
        onClearAll={handleClearAll}
        profiles={profiles}
        projects={projects}
      />
    </div>
  );
}