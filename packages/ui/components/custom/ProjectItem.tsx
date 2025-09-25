import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ProjectContextMenu } from './ProjectContextMenu';
import { ProjectColorPicker, getProjectColorHSL, type ProjectColor } from './ProjectColorPicker';
import type { Project } from '@perfect-task-app/models';

interface ProjectItemProps {
  project: Project;
  isSelected: boolean;
  onClick: (projectId: string, isCtrlClick: boolean) => void;
  onColorChange?: (projectId: string, color: ProjectColor) => void;
  userId: string;
  className?: string;
}

export function ProjectItem({
  project,
  isSelected,
  onClick,
  onColorChange,
  userId,
  className
}: ProjectItemProps) {
  const handleClick = (event: React.MouseEvent) => {
    const isCtrlClick = event.ctrlKey || event.metaKey;
    onClick(project.id, isCtrlClick);
  };

  const handleColorChange = (color: ProjectColor) => {
    onColorChange?.(project.id, color);
  };

  return (
    <div className={cn('group relative', className)}>
      <div className="flex items-center w-full">
        {/* Color picker */}
        {!project.is_general ? (
          <ProjectColorPicker
            currentColor={project.color || 'sky'}
            onColorChange={handleColorChange}
          >
            <button
              className="w-3 h-3 rounded-full mr-2 flex-shrink-0 hover:scale-110 transition-transform duration-200 border border-gray-300 hover:border-gray-400"
              style={{ backgroundColor: getProjectColorHSL(project.color || 'sky') }}
              onClick={(e) => e.stopPropagation()}
            />
          </ProjectColorPicker>
        ) : (
          <div
            className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
            style={{ backgroundColor: getProjectColorHSL(project.color || 'sky') }}
          />
        )}

        {/* Project button */}
        <Button
          variant="ghost"
          className={cn(
            'flex-1 justify-start h-auto p-2 font-normal',
            isSelected && 'bg-blue-50 text-blue-700 border-blue-200'
          )}
          onClick={handleClick}
        >
          {/* Project name */}
          <span className="flex-1 text-left truncate">
            {project.name}
          </span>

          {/* General badge */}
          {project.is_general && (
            <Badge variant="secondary" className="ml-2 text-xs">
              General
            </Badge>
          )}
        </Button>
      </div>

      {/* Context menu (only for non-general projects) */}
      {!project.is_general && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <ProjectContextMenu project={project} userId={userId} />
        </div>
      )}
    </div>
  );
}