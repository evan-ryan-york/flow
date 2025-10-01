'use client';

import React, { useState } from 'react';
import { Button } from '@perfect-task-app/ui/components/ui/button';
import { Settings } from 'iconoir-react';
import { CustomPropertyManager } from '@perfect-task-app/ui/components/custom/CustomPropertyManager';

interface CustomPropertiesButtonProps {
  selectedProjectIds: string[];
  userId: string;
  customPropertyCount: number;
  className?: string;
}

export function CustomPropertiesButton({
  selectedProjectIds,
  userId,
  customPropertyCount,
  className
}: CustomPropertiesButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Only show the button when exactly one project is selected
  // (CustomPropertyManager works with single project)
  const canManageProperties = selectedProjectIds.length === 1;

  if (!canManageProperties) {
    return null;
  }

  const projectId = selectedProjectIds[0];

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={`${className || ''} ${
          customPropertyCount > 0 ? 'bg-green-50 border-green-300 text-green-700' : ''
        }`}
        title={`Manage custom properties${customPropertyCount > 0 ? ` (${customPropertyCount})` : ''}`}
      >
        <Settings className="h-4 w-4 mr-2" />
        Properties
        {customPropertyCount > 0 && (
          <span className="ml-1 bg-green-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] h-5 flex items-center justify-center">
            {customPropertyCount}
          </span>
        )}
      </Button>

      <CustomPropertyManager
        projectId={projectId}
        projectName={`Project ${projectId}`} // This would ideally be the actual project name
        userId={userId}
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
}