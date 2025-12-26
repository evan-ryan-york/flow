'use client';

import React, { useState } from 'react';
import { Project } from '@flow-app/models';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { getProjectColorHex, getProjectColorLightBackground } from '../../colors';

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
          className={`inline-flex items-center gap-2 px-2 py-1 text-xs font-medium transition-colors cursor-pointer border ${className}`}
          style={{
            backgroundColor: getProjectColorLightBackground(project.color || 'blue'),
            borderColor: getProjectColorHex(project.color || 'blue'),
            color: getProjectColorHex(project.color || 'blue'),
          }}
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
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: getProjectColorHex(project.color || 'blue') }}
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
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getProjectColorHex(proj.color || 'blue') }}
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