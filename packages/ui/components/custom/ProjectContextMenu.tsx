import React, { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { Button } from '../ui/button';
import { MoreVert, EditPencil, Bin, Palette } from 'iconoir-react';
import { DeleteProjectDialog } from './DeleteProjectDialog';
import { RenameProjectDialog } from './RenameProjectDialog';
import type { Project } from '@perfect-task-app/models';

interface ProjectContextMenuProps {
  project: Project;
  userId: string;
}

export function ProjectContextMenu({ project, userId }: ProjectContextMenuProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVert className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48" align="end">
          <div className="space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                setShowRenameDialog(true);
                setIsOpen(false);
              }}
            >
              <EditPencil className="h-4 w-4 mr-2" />
              Rename
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 hover:text-red-700"
              onClick={() => {
                setShowDeleteDialog(true);
                setIsOpen(false);
              }}
            >
              <Bin className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <DeleteProjectDialog
        project={project}
        userId={userId}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />

      <RenameProjectDialog
        project={project}
        userId={userId}
        open={showRenameDialog}
        onOpenChange={setShowRenameDialog}
      />
    </>
  );
}