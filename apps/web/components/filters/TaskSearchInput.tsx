'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@perfect-task-app/ui/components/ui/input';
import { Search, Xmark } from 'iconoir-react';

interface TaskSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  totalTasks: number;
  filteredTasks: number;
  className?: string;
}

export function TaskSearchInput({
  value,
  onChange,
  placeholder,
  totalTasks,
  filteredTasks,
  className
}: TaskSearchInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [_isFocused, setIsFocused] = useState(false);

  // Debounce the search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localValue, onChange, value]);

  // Update local value when external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleClear = useCallback(() => {
    setLocalValue('');
    onChange('');
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClear();
    }
  }, [handleClear]);

  // Generate dynamic placeholder with task count
  const dynamicPlaceholder = placeholder ||
    `Search ${totalTasks} task${totalTasks !== 1 ? 's' : ''}...`;

  const showResultCount = value.trim() && totalTasks !== filteredTasks;

  return (
    <div className={`relative ${className || ''}`}>
      <div className="relative">
        {/* Search icon */}
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>

        {/* Input field */}
        <Input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={dynamicPlaceholder}
          className="pl-10 pr-10 w-full"
        />

        {/* Clear button */}
        {value && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600 text-gray-400 transition-colors"
            type="button"
            title="Clear search"
          >
            <Xmark className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search result count */}
      {showResultCount && (
        <div className="absolute top-full left-0 mt-1 text-xs text-gray-500 bg-white px-2 py-1 rounded shadow-sm border">
          {filteredTasks === 0 ? (
            'No tasks found'
          ) : (
            `${filteredTasks} of ${totalTasks} task${filteredTasks !== 1 ? 's' : ''}`
          )}
        </div>
      )}
    </div>
  );
}