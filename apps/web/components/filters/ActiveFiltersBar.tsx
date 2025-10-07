'use client';

import React from 'react';
import { Button } from '@perfect-task-app/ui/components/ui/button';
import { Xmark, Search, Filter, Group } from 'iconoir-react';
import { FilterState, hasActiveFilters } from '@perfect-task-app/ui/lib/taskFiltering';
import { GroupByOption } from '@perfect-task-app/ui/lib/taskGrouping';

interface ActiveFiltersBarProps {
  searchQuery: string;
  selectedFilters: FilterState;
  groupBy: GroupByOption | null;
  totalTasks: number;
  filteredTasks: number;
  onSearchClear: () => void;
  onFilterClear: (filterType: keyof FilterState) => void;
  onGroupByClear: () => void;
  onClearAll: () => void;
  profiles?: any[];
  projects?: any[];
}

export function ActiveFiltersBar({
  searchQuery,
  selectedFilters,
  groupBy,
  totalTasks,
  filteredTasks,
  onSearchClear,
  onFilterClear,
  onGroupByClear,
  onClearAll,
  profiles = [],
  projects = []
}: ActiveFiltersBarProps) {
  const hasSearch = searchQuery.trim() !== '';
  const hasFilters = hasActiveFilters(selectedFilters);
  const hasGrouping = groupBy && groupBy !== 'none';
  const hasAnyActive = hasSearch || hasFilters || hasGrouping;

  if (!hasAnyActive) {
    return null;
  }

  const getProfileName = (assigneeId: string) => {
    if (assigneeId === 'unassigned') return 'Unassigned';
    const profile = profiles.find(p => p.id === assigneeId);
    return profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown User' : 'Unknown User';
  };

  const getProjectName = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || `Project ${projectId}`;
  };

  const getDueDateLabel = (dueDate: any) => {
    switch (dueDate.type) {
      case 'overdue': return 'Overdue';
      case 'today': return 'Today';
      case 'thisWeek': return 'This Week';
      case 'nextWeek': return 'Next Week';
      case 'noDate': return 'No Due Date';
      default: return 'Custom Date';
    }
  };

  const getCompletionLabel = (completion: any) => {
    switch (completion.type) {
      case 'all-completed': return 'All Completed';
      case 'completed-last-week': return 'Completed Last Week';
      default: return 'Completed';
    }
  };

  const getGroupByLabel = (groupByValue: GroupByOption) => {
    switch (groupByValue) {
      case 'project': return 'Project';
      case 'dueDate': return 'Due Date';
      case 'assignee': return 'Assignee';
      default: return 'Unknown';
    }
  };

  return (
    <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search chip */}
          {hasSearch && (
            <div className="flex items-center gap-1 bg-white px-3 py-1 rounded-full text-sm border border-blue-200">
              <Search className="h-3 w-3 text-blue-600" />
              <span className="text-gray-700">"{searchQuery}"</span>
              <button
                onClick={onSearchClear}
                className="text-gray-500 hover:text-gray-700 ml-1"
                title="Clear search"
              >
                <Xmark className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Assignee filters */}
          {selectedFilters.assignee.map((assignee) => (
            <div key={assignee} className="flex items-center gap-1 bg-white px-3 py-1 rounded-full text-sm border border-blue-200">
              <Filter className="h-3 w-3 text-blue-600" />
              <span className="text-gray-700">Assignee: {getProfileName(assignee)}</span>
              <button
                onClick={() => onFilterClear('assignee')}
                className="text-gray-500 hover:text-gray-700 ml-1"
                title="Clear assignee filter"
              >
                <Xmark className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* Due date filter */}
          {selectedFilters.dueDate && (
            <div className="flex items-center gap-1 bg-white px-3 py-1 rounded-full text-sm border border-blue-200">
              <Filter className="h-3 w-3 text-blue-600" />
              <span className="text-gray-700">Due: {getDueDateLabel(selectedFilters.dueDate)}</span>
              <button
                onClick={() => onFilterClear('dueDate')}
                className="text-gray-500 hover:text-gray-700 ml-1"
                title="Clear due date filter"
              >
                <Xmark className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Project filters */}
          {selectedFilters.project.map((projectId) => (
            <div key={projectId} className="flex items-center gap-1 bg-white px-3 py-1 rounded-full text-sm border border-blue-200">
              <Filter className="h-3 w-3 text-blue-600" />
              <span className="text-gray-700">Project: {getProjectName(projectId)}</span>
              <button
                onClick={() => onFilterClear('project')}
                className="text-gray-500 hover:text-gray-700 ml-1"
                title="Clear project filter"
              >
                <Xmark className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* Completion filter */}
          {selectedFilters.completion && (
            <div className="flex items-center gap-1 bg-white px-3 py-1 rounded-full text-sm border border-blue-200">
              <Filter className="h-3 w-3 text-blue-600" />
              <span className="text-gray-700">{getCompletionLabel(selectedFilters.completion)}</span>
              <button
                onClick={() => onFilterClear('completion')}
                className="text-gray-500 hover:text-gray-700 ml-1"
                title="Clear completion filter"
              >
                <Xmark className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Group by chip */}
          {hasGrouping && (
            <div className="flex items-center gap-1 bg-white px-3 py-1 rounded-full text-sm border border-purple-200">
              <Group className="h-3 w-3 text-purple-600" />
              <span className="text-gray-700">Grouped by {getGroupByLabel(groupBy!)}</span>
              <button
                onClick={onGroupByClear}
                className="text-gray-500 hover:text-gray-700 ml-1"
                title="Clear grouping"
              >
                <Xmark className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Results count */}
          <div className="text-sm text-gray-600">
            {filteredTasks === totalTasks ? (
              <span>{totalTasks} task{totalTasks !== 1 ? 's' : ''}</span>
            ) : (
              <span>
                {filteredTasks} of {totalTasks} task{totalTasks !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Clear all button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-blue-700 hover:text-blue-800 hover:bg-blue-100"
          >
            Clear All
          </Button>
        </div>
      </div>
    </div>
  );
}