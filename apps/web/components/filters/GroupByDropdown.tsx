'use client';

import React, { useState } from 'react';
import { Button } from '@perfect-task-app/ui/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@perfect-task-app/ui';
import { Group, Check } from 'iconoir-react';
import { GroupByOption, getAvailableGroupByOptions } from '@perfect-task-app/ui/lib/taskGrouping';
import { Task, CustomPropertyDefinition } from '@perfect-task-app/models';

interface GroupByDropdownProps {
  value: GroupByOption | null;
  onChange: (groupBy: GroupByOption | null) => void;
  tasks: Task[];
  selectedProjectIds: string[];
  customPropertyDefinitions?: CustomPropertyDefinition[];
  className?: string;
}

export function GroupByDropdown({
  value,
  onChange,
  tasks,
  selectedProjectIds,
  customPropertyDefinitions = [],
  className
}: GroupByDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const availableOptions = getAvailableGroupByOptions(tasks, selectedProjectIds);

  // Add custom property options (only select and date types for better UX)
  const customPropertyOptions = customPropertyDefinitions
    .filter(prop => prop.type === 'select' || prop.type === 'date')
    .map(prop => ({
      value: { type: 'customProperty' as const, definitionId: prop.id },
      label: `Group by ${prop.name}`,
      disabled: false
    }));

  const allOptions = [...availableOptions, ...customPropertyOptions];

  // Find active option
  let activeOption;
  if (!value || value === 'none') {
    activeOption = availableOptions.find(opt => opt.value === 'none');
  } else if (typeof value === 'object' && value !== null && value.type === 'customProperty') {
    const prop = customPropertyDefinitions.find(p => p.id === value.definitionId);
    activeOption = prop ? { value, label: `Group by ${prop.name}` } : undefined;
  } else {
    activeOption = availableOptions.find(opt => opt.value === value);
  }

  const hasActiveGrouping = value && value !== 'none';

  const handleOptionSelect = (option: GroupByOption) => {
    const newValue = option === 'none' ? null : option;
    onChange(newValue);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`${className || ''} ${
            hasActiveGrouping ? 'bg-purple-50 border-purple-300 text-purple-700' : ''
          }`}
        >
          <Group className="h-4 w-4 mr-2" />
          {hasActiveGrouping ? (
            <>
              Group: {activeOption?.label || 'Unknown'}
            </>
          ) : (
            'Group'
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-0" align="end">
        <div className="p-3 border-b border-gray-200">
          <h3 className="font-medium text-gray-900">Group Tasks</h3>
          <p className="text-sm text-gray-500 mt-1">Organize tasks by category</p>
        </div>

        <div className="p-2">
          <div className="space-y-1">
            {allOptions.map((option, index) => {
              // Determine if this option is selected
              let isSelected = false;
              if (typeof option.value === 'object' && option.value !== null && option.value.type === 'customProperty') {
                isSelected = typeof value === 'object' && value !== null && value.type === 'customProperty' && value.definitionId === option.value.definitionId;
              } else {
                isSelected = (value || 'none') === option.value;
              }

              // Generate unique key
              const key = typeof option.value === 'object' && option.value !== null
                ? `custom-${option.value.definitionId}`
                : String(option.value);

              return (
                <button
                  key={key}
                  onClick={() => !option.disabled && handleOptionSelect(option.value)}
                  disabled={option.disabled}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                    option.disabled
                      ? 'text-gray-400 cursor-not-allowed'
                      : isSelected
                      ? 'bg-purple-50 text-purple-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className={`w-4 h-4 border rounded-full flex items-center justify-center ${
                    isSelected && !option.disabled
                      ? 'bg-purple-600 border-purple-600'
                      : option.disabled
                      ? 'border-gray-200'
                      : 'border-gray-300'
                  }`}>
                    {isSelected && !option.disabled && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>

                  <span className="flex-1 text-left">
                    {option.label}
                  </span>

                  {option.disabled && (
                    <span className="text-xs text-gray-400">
                      N/A
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500">
            Grouping organizes tasks into collapsible sections for better organization.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}