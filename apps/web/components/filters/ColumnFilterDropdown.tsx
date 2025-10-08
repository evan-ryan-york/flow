'use client';

import React, { useState } from 'react';
import { Button } from '@perfect-task-app/ui/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@perfect-task-app/ui';
import { Filter, Check, Xmark } from 'iconoir-react';
import { FilterState, FilterOption, getActiveFilterCount, DateRange, CompletionFilter } from '@perfect-task-app/ui/lib/taskFiltering';

interface ColumnFilterDropdownProps {
  availableFilters: {
    assignee: FilterOption[];
    dueDate: FilterOption[];
    project: FilterOption[];
    completion: FilterOption[];
    completionTimeframe: FilterOption[];
  };
  selectedFilters: FilterState;
  onChange: (filters: FilterState) => void;
  className?: string;
}

export function ColumnFilterDropdown({
  availableFilters,
  selectedFilters,
  onChange,
  className
}: ColumnFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeFilterCount = getActiveFilterCount(selectedFilters);
  const hasActiveFilters = activeFilterCount > 0;

  const handleAssigneeToggle = (value: string | DateRange | CompletionFilter) => {
    if (typeof value !== 'string') return;
    const assignee = value;
    const newAssignees = selectedFilters.assignee.includes(assignee)
      ? selectedFilters.assignee.filter(a => a !== assignee)
      : [...selectedFilters.assignee, assignee];

    onChange({
      ...selectedFilters,
      assignee: newAssignees
    });
  };

  const handleDueDateToggle = (value: string | DateRange | CompletionFilter) => {
    if (typeof value === 'string' || !('type' in value) || (value.type !== 'overdue' && value.type !== 'today' && value.type !== 'thisWeek' && value.type !== 'nextWeek' && value.type !== 'noDate' && value.type !== 'custom')) return;
    const dateRange = value as DateRange;
    const isSelected = selectedFilters.dueDate &&
                      selectedFilters.dueDate.type === dateRange.type;

    onChange({
      ...selectedFilters,
      dueDate: isSelected ? null : dateRange
    });
  };

  const handleProjectToggle = (value: string | DateRange | CompletionFilter) => {
    if (typeof value !== 'string') return;
    const projectId = value;
    const newProjects = selectedFilters.project.includes(projectId)
      ? selectedFilters.project.filter(p => p !== projectId)
      : [...selectedFilters.project, projectId];

    onChange({
      ...selectedFilters,
      project: newProjects
    });
  };

  const handleCompletionToggle = (value: string | DateRange | CompletionFilter) => {
    if (typeof value === 'string' || !('status' in value)) return;
    const completionFilter = value as CompletionFilter;
    const isSelected = selectedFilters.completion &&
                      selectedFilters.completion.status === completionFilter.status &&
                      selectedFilters.completion.timeframe === completionFilter.timeframe;

    onChange({
      ...selectedFilters,
      completion: isSelected ? null : completionFilter
    });
  };

  const clearAllFilters = () => {
    onChange({
      ...selectedFilters,
      assignee: [],
      dueDate: null,
      project: [],
      completion: null
    });
  };

  const FilterSection = ({
    title,
    options,
    selectedValues,
    onToggle,
    renderValue = (option) => option.label
  }: {
    title: string;
    options: FilterOption[];
    selectedValues: Array<string | DateRange | CompletionFilter>;
    onToggle: (value: FilterOption['value']) => void;
    renderValue?: (option: FilterOption) => string;
  }) => {
    if (options.length === 0) return null;

    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-900 px-3">{title}</h4>
        <div className="space-y-1">
          {options.map((option) => {
            const isSelected = selectedValues.some(val => {
              if (typeof val === 'string' && typeof option.value === 'string') {
                return val === option.value;
              }
              if (typeof val === 'object' && val !== null && typeof option.value === 'object' && option.value !== null) {
                // Handle DateRange comparison
                if ('type' in val && 'type' in option.value && !('status' in val) && !('status' in option.value)) {
                  return (val as { type?: string }).type === (option.value as { type?: string }).type;
                }
                // Handle CompletionFilter comparison
                if ('status' in val && 'status' in option.value) {
                  const valFilter = val as CompletionFilter;
                  const optionFilter = option.value as CompletionFilter;
                  return valFilter.status === optionFilter.status &&
                         valFilter.timeframe === optionFilter.timeframe;
                }
              }
              return false;
            });

            return (
              <button
                key={option.key}
                onClick={() => onToggle(option.value)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-100 rounded-md transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                    isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className={isSelected ? 'font-medium text-gray-900' : 'text-gray-700'}>
                    {renderValue(option)}
                  </span>
                </div>
                {option.count !== undefined && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {option.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`relative ${className || ''} ${
            hasActiveFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : ''
          }`}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filter
          {hasActiveFilters && (
            <span className="ml-1 bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] h-5 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Filter Tasks</h3>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Xmark className="h-3 w-3" />
                Clear All
              </button>
            )}
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          <div className="p-3 space-y-6">
            <FilterSection
              title="Assigned To"
              options={availableFilters.assignee}
              selectedValues={selectedFilters.assignee}
              onToggle={handleAssigneeToggle}
            />

            <FilterSection
              title="Due Date"
              options={availableFilters.dueDate}
              selectedValues={selectedFilters.dueDate ? [selectedFilters.dueDate] : []}
              onToggle={handleDueDateToggle}
            />

            {availableFilters.project.length > 1 && (
              <FilterSection
                title="Project"
                options={availableFilters.project}
                selectedValues={selectedFilters.project}
                onToggle={handleProjectToggle}
              />
            )}

            <FilterSection
              title="Completion Status"
              options={availableFilters.completion}
              selectedValues={selectedFilters.completion ? [selectedFilters.completion] : []}
              onToggle={handleCompletionToggle}
            />

            {/* Show timeframe options when completed or all tasks are selected */}
            {selectedFilters.completion &&
             (selectedFilters.completion.status === 'completed' || selectedFilters.completion.status === 'all') && (() => {
               // Dynamically generate timeframe options based on selected status
               const status = selectedFilters.completion.status;
               const timeframeOptions: FilterOption[] = [
                 { key: 'all-time', label: 'All time', type: 'completion' as const, value: { status, timeframe: 'all-time' } as CompletionFilter },
                 { key: 'last-month', label: 'Last month', type: 'completion' as const, value: { status, timeframe: 'last-month' } as CompletionFilter },
                 { key: 'last-week', label: 'Last week', type: 'completion' as const, value: { status, timeframe: 'last-week' } as CompletionFilter },
               ];

               return (
                 <div className="ml-4 pl-4 border-l-2 border-gray-200">
                   <FilterSection
                     title="Completed Timeframe"
                     options={timeframeOptions}
                     selectedValues={selectedFilters.completion ? [selectedFilters.completion] : []}
                     onToggle={handleCompletionToggle}
                   />
                 </div>
               );
             })()}

            {Object.values(availableFilters).every(arr => arr.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                <Filter className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No filter options available</p>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}