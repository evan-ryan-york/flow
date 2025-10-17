'use client';

import React, { useState, useEffect } from 'react';
import { Project } from '@perfect-task-app/models';
import { useProjectSearch } from '@perfect-task-app/data';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Badge } from '../ui/badge';
import { getProjectColorHex } from '../../colors';

interface ProjectAutocompleteProps {
  query: string;
  onSelect: (project: Project) => void;
  userId: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export const ProjectAutocomplete: React.FC<ProjectAutocompleteProps> = ({
  query,
  onSelect,
  userId,
  isOpen = false,
  onOpenChange,
  children,
}) => {
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Debounce the query to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [debouncedQuery]);

  const {
    data: projects = [],
    isLoading,
    error,
  } = useProjectSearch(userId, debouncedQuery, isOpen && query.length > 0);

  const handleSelect = (project: Project) => {
    onSelect(project);
    onOpenChange?.(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || projects.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % projects.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + projects.length) % projects.length);
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (projects[selectedIndex]) {
          handleSelect(projects[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onOpenChange?.(false);
        break;
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      {children && (
        <PopoverTrigger asChild>
          {children}
        </PopoverTrigger>
      )}
      <PopoverContent
        className="w-80 p-0"
        align="start"
        onKeyDown={handleKeyDown}
        data-testid="autocomplete-dropdown"
      >
        <div className="max-h-60 overflow-auto">
          <div className="p-2">
            {isLoading ? (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                Searching...
              </div>
            ) : error ? (
              <div className="px-3 py-2 text-sm text-red-600">
                {error.message || 'Search failed'}
              </div>
            ) : projects.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No projects found</div>
            ) : (
              <div className="space-y-1">
                {projects.map((project, index) => (
                  <div
                    key={project.id}
                    onClick={() => handleSelect(project)}
                    className={`cursor-pointer px-3 py-2 rounded-md hover:bg-gray-100 ${
                      index === selectedIndex ? 'bg-blue-50' : ''
                    }`}
                    data-selected={index === selectedIndex}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full border-2"
                        style={{
                          backgroundColor: getProjectColorHex(project.color || 'blue'),
                          borderColor: getProjectColorHex(project.color || 'blue'),
                        }}
                      />
                      <span className="text-sm font-medium">{project.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};