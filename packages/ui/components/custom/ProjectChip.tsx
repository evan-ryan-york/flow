'use client';

import React, { useState } from 'react';
import { Project } from '@perfect-task-app/models';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

interface ProjectChipProps {
  project: Project;
  onRemove: () => void;
  onProjectSelect?: (project: Project) => void;
  projects?: Project[];
  className?: string;
}

export const ProjectChip: React.FC<ProjectChipProps> = ({
  project,
  onRemove,
  onProjectSelect,
  projects = [],
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const getColorClasses = (color: string) => {
    switch (color) {
      case 'rose':
        return 'bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200';
      case 'amber':
        return 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200';
      case 'mint':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200';
      case 'sky':
        return 'bg-sky-100 text-sky-800 border-sky-200 hover:bg-sky-200';
      case 'violet':
        return 'bg-violet-100 text-violet-800 border-violet-200 hover:bg-violet-200';
      case 'lime':
        return 'bg-lime-100 text-lime-800 border-lime-200 hover:bg-lime-200';
      case 'teal':
        return 'bg-teal-100 text-teal-800 border-teal-200 hover:bg-teal-200';
      case 'crimson':
        return 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200';
    }
  };

  const getColorDot = (color: string) => {
    switch (color) {
      case 'rose':
        return 'bg-rose-500';
      case 'amber':
        return 'bg-amber-500';
      case 'mint':
        return 'bg-emerald-500';
      case 'sky':
        return 'bg-sky-500';
      case 'violet':
        return 'bg-violet-500';
      case 'lime':
        return 'bg-lime-500';
      case 'teal':
        return 'bg-teal-500';
      case 'crimson':
        return 'bg-red-600';
      default:
        return 'bg-gray-500';
    }
  };

  const handleProjectSelect = (selectedProject: Project) => {
    if (onProjectSelect) {
      onProjectSelect(selectedProject);
    }
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className={`inline-flex items-center gap-2 px-2 py-1 text-xs font-medium transition-colors cursor-pointer ${getColorClasses(
            project.color
          )} ${className}`}
          data-testid={`project-chip-${project.name.toLowerCase().replace(/\s+/g, '-')}`}
          onClick={(e) => {
            // Only open popover if we have projects and onProjectSelect handler
            if (projects.length > 0 && onProjectSelect) {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(true);
            }
          }}
        >
          <div
            className={`w-2 h-2 rounded-full ${getColorDot(project.color)}`}
            aria-hidden="true"
          />
          <span className="max-w-24 truncate">{project.name}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
            className="h-4 w-4 p-0 hover:bg-transparent ml-1"
            aria-label={`Remove ${project.name} project`}
            data-testid="remove-project-chip"
          >
            ×
          </Button>
        </Badge>
      </PopoverTrigger>

      {projects.length > 0 && onProjectSelect && (
        <PopoverContent className="w-64 p-2" align="start">
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-gray-700 px-2 py-1">Switch Project</h4>
            <div className="max-h-48 overflow-y-auto">
              {projects.map((proj) => (
                <Button
                  key={proj.id}
                  variant="ghost"
                  size="sm"
                  className={`w-full justify-start gap-2 px-2 py-1 h-auto text-xs ${
                    proj.id === project.id ? 'bg-gray-100' : ''
                  }`}
                  onClick={() => handleProjectSelect(proj)}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${getColorDot(proj.color)}`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{proj.name}</span>
                  {proj.id === project.id && (
                    <span className="ml-auto text-xs text-gray-500">Current</span>
                  )}
                </Button>
              ))}
            </div>
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
};