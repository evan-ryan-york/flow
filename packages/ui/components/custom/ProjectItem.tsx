import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Lock } from 'iconoir-react';
import { ProjectContextMenu } from './ProjectContextMenu';
import { ProjectColorPicker, getProjectColorHex, type ProjectColor } from './ProjectColorPicker';
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
        {/* Selection indicator - solid dot for selected, hollow circle for unselected */}
        <div className="relative mr-2 flex-shrink-0">
          <motion.div
            animate={{
              scale: isSelected ? 1.1 : 1,
            }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
          >
            {isSelected ? (
              // Solid dot for selected projects
              <motion.div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getProjectColorHex(project.color || 'blue') }}
                initial={false}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              />
            ) : (
              // Hollow circle for unselected projects
              <motion.div
                className="w-3 h-3 rounded-full"
                style={{
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: getProjectColorHex(project.color || 'blue')
                }}
                initial={false}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              />
            )}
          </motion.div>

          {/* Color picker overlay */}
          <ProjectColorPicker
            currentColor={project.color || 'blue'}
            onColorChange={handleColorChange}
          >
            <button
              className="absolute inset-0 w-full h-full rounded-full opacity-0 hover:opacity-10 bg-gray-500 transition-opacity duration-200"
              onClick={(e) => e.stopPropagation()}
            />
          </ProjectColorPicker>
        </div>

        {/* Project button */}
        <motion.div
          className="flex-1"
          whileHover={{ x: 2 }}
          transition={{ duration: 0.15, ease: 'easeInOut' }}
        >
          <Button
            variant="ghost"
            className="flex-1 justify-start h-auto p-2 hover:bg-gray-50 w-full"
            onClick={handleClick}
          >
          {/* Project name */}
          <span className={cn(
            "flex-1 text-left truncate flex items-center",
            isSelected ? "font-semibold text-gray-900" : "font-normal text-gray-700"
          )}>
            {project.name}
            {/* Lock icon for General project */}
            {project.is_general && (
              <Lock className="h-3 w-3 ml-1 text-gray-500" />
            )}
          </span>
        </Button>
        </motion.div>
      </div>

      {/* Context menu (only for non-general projects) */}
      {!project.is_general && (
        <div className="absolute top-1/2 -translate-y-1/2 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <ProjectContextMenu project={project} userId={userId} />
        </div>
      )}
    </div>
  );
}