'use client';

import React, { useState } from 'react';
import { Button } from '@perfect-task-app/ui/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@perfect-task-app/ui';
import { Filter, Check, Xmark } from 'iconoir-react';
import { FilterState, FilterOption, getActiveFilterCount } from '@perfect-task-app/ui/lib/taskFiltering';

interface ColumnFilterDropdownProps {
  availableFilters: {
    status: FilterOption[];
    assignee: FilterOption[];
    dueDate: FilterOption[];
    project: FilterOption[];
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

  const handleStatusToggle = (status: string) => {
    const newStatuses = selectedFilters.status.includes(status)
      ? selectedFilters.status.filter(s => s !== status)
      : [...selectedFilters.status, status];

    onChange({
      ...selectedFilters,
      status: newStatuses
    });
  };

  const handleAssigneeToggle = (assignee: string) => {
    const newAssignees = selectedFilters.assignee.includes(assignee)
      ? selectedFilters.assignee.filter(a => a !== assignee)
      : [...selectedFilters.assignee, assignee];

    onChange({
      ...selectedFilters,
      assignee: newAssignees
    });
  };

  const handleDueDateToggle = (dateRange: any) => {
    const isSelected = selectedFilters.dueDate &&
                      selectedFilters.dueDate.type === dateRange.type;

    onChange({
      ...selectedFilters,
      dueDate: isSelected ? null : dateRange
    });
  };

  const handleProjectToggle = (projectId: string) => {
    const newProjects = selectedFilters.project.includes(projectId)
      ? selectedFilters.project.filter(p => p !== projectId)
      : [...selectedFilters.project, projectId];

    onChange({
      ...selectedFilters,
      project: newProjects
    });
  };

  const clearAllFilters = () => {
    onChange({
      ...selectedFilters,
      status: [],
      assignee: [],
      dueDate: null,
      project: []
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
    selectedValues: any[];
    onToggle: (value: any) => void;
    renderValue?: (option: FilterOption) => string;
  }) => {
    if (options.length === 0) return null;

    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-900 px-3">{title}</h4>
        <div className="space-y-1">
          {options.map((option) => {
            const isSelected = selectedValues.some(val =>
              typeof val === 'string' ? val === option.value :
              val?.type === option.value?.type
            );

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
              title="Status"
              options={availableFilters.status}
              selectedValues={selectedFilters.status}
              onToggle={handleStatusToggle}
            />

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