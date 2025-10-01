'use client';

import { useState, useEffect } from 'react';
import { ProjectsPanel } from '@perfect-task-app/ui/custom';
import { TaskHub } from './TaskHub';
import { CalendarPanel } from './CalendarPanel';
import { useGeneralProject, useVisibleProjectIds, useUpdateVisibleProjectIds } from '@perfect-task-app/data';

interface ThreeColumnLayoutProps {
  userId: string;
}

export function ThreeColumnLayout({ userId }: ThreeColumnLayoutProps) {
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Load user's saved project visibility preferences
  const { data: generalProject } = useGeneralProject(userId);
  const { data: visibleProjectIds, isLoading: isLoadingVisibleProjects } = useVisibleProjectIds(userId);
  const updateVisibleProjectsMutation = useUpdateVisibleProjectIds();

  // Initialize with saved visible projects or default to General project
  useEffect(() => {
    if (!hasInitialized && !isLoadingVisibleProjects) {
      if (visibleProjectIds && visibleProjectIds.length > 0) {
        setSelectedProjectIds(visibleProjectIds);
      } else if (generalProject) {
        setSelectedProjectIds([generalProject.id]);
      }
      setHasInitialized(true);
    }
  }, [generalProject, visibleProjectIds, isLoadingVisibleProjects, hasInitialized]);

  // Save project selection changes to the database
  const handleProjectSelectionChange = (newProjectIds: string[]) => {
    setSelectedProjectIds(newProjectIds);
    updateVisibleProjectsMutation.mutate({ projectIds: newProjectIds, userId });
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Column 1: Projects/Navigation Panel */}
      <div className="w-64 border-r border-gray-200 flex-shrink-0">
        <ProjectsPanel
          userId={userId}
          selectedProjectIds={selectedProjectIds}
          onProjectSelectionChange={handleProjectSelectionChange}
        />
      </div>

      {/* Column 2: Task Hub */}
      <div className="flex-1 flex flex-col min-w-0">
        <TaskHub
          userId={userId}
          selectedProjectIds={selectedProjectIds}
          selectedViewId={selectedViewId}
          onViewChange={setSelectedViewId}
        />
      </div>

      {/* Column 3: Calendar Panel */}
      <div className="w-96 border-l border-gray-200 flex-shrink-0">
        <CalendarPanel userId={userId} />
      </div>
    </div>
  );
}