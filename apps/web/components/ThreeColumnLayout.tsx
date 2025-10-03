'use client';

import { useState, useEffect } from 'react';
import { Panel, PanelGroup } from 'react-resizable-panels';
import { ProjectsPanel } from '@perfect-task-app/ui/custom';
import { TaskHub } from './TaskHub';
import { CalendarPanel } from './CalendarPanel';
import { ResizeHandle } from './ResizeHandle';
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
      {/* Column 1: Projects/Navigation Panel - Keep Fixed */}
      <div className="w-64 border-r border-gray-200 flex-shrink-0">
        <ProjectsPanel
          userId={userId}
          selectedProjectIds={selectedProjectIds}
          onProjectSelectionChange={handleProjectSelectionChange}
        />
      </div>

      {/* Columns 2 & 3: Resizable Task Hub and Calendar */}
      <PanelGroup
        direction="horizontal"
        autoSaveId="task-calendar-layout"
        className="flex-1"
      >
        {/* Column 2: Task Hub - Resizable */}
        <Panel
          defaultSize={60}
          minSize={30}
          maxSize={80}
          id="task-hub-panel"
        >
          <div className="flex flex-col h-full min-w-0">
            <TaskHub
              userId={userId}
              selectedProjectIds={selectedProjectIds}
              selectedViewId={selectedViewId}
              onViewChange={setSelectedViewId}
            />
          </div>
        </Panel>

        {/* Resize Handle */}
        <ResizeHandle />

        {/* Column 3: Calendar Panel - Resizable */}
        <Panel
          defaultSize={40}
          minSize={20}
          maxSize={70}
          id="calendar-panel"
        >
          <div className="flex flex-col h-full border-l border-gray-200">
            <CalendarPanel userId={userId} />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}