import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ProjectContextMenu } from './ProjectContextMenu';
import type { Project } from '@perfect-task-app/models';

interface ProjectItemProps {
  project: Project;
  isSelected: boolean;
  onClick: (projectId: string, isCtrlClick: boolean) => void;
  userId: string;
  className?: string;
}

export function ProjectItem({
  project,
  isSelected,
  onClick,
  userId,
  className
}: ProjectItemProps) {
  const handleClick = (event: React.MouseEvent) => {
    const isCtrlClick = event.ctrlKey || event.metaKey;
    onClick(project.id, isCtrlClick);
  };

  return (
    <div className={cn('group relative', className)}>
      <Button
        variant="ghost"
        className={cn(
          'w-full justify-start h-auto p-2 font-normal',
          isSelected && 'bg-blue-50 text-blue-700 border-blue-200'
        )}
        onClick={handleClick}
      >
        {/* Color indicator */}
        <div
          className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
          style={{ backgroundColor: project.project_color }}
        />

        {/* Project name */}
        <span className="flex-1 text-left truncate">
          {project.project_name}
        </span>

        {/* Default badge */}
        {project.is_default && (
          <Badge variant="secondary" className="ml-2 text-xs">
            Default
          </Badge>
        )}
      </Button>

      {/* Context menu (only for non-default projects) */}
      {!project.is_default && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <ProjectContextMenu project={project} userId={userId} />
        </div>
      )}
    </div>
  );
}