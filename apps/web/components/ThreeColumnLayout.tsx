'use client';

import { useState, useEffect } from 'react';
import { ProjectsPanel } from '@perfect-task-app/ui/custom';
import { TaskHub } from './TaskHub';
import { CalendarPanel } from './CalendarPanel';
import { useGeneralProject } from '@perfect-task-app/data';

interface ThreeColumnLayoutProps {
  userId: string;
}

export function ThreeColumnLayout({ userId }: ThreeColumnLayoutProps) {
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  console.log('🏛️ ThreeColumnLayout render - selectedProjectIds:', selectedProjectIds);

  // Auto-select General project on initial load only
  const { data: generalProject } = useGeneralProject(userId);

  useEffect(() => {
    if (generalProject && !hasInitialized) {
      console.log('🎯 Auto-selecting General project on initial load:', generalProject.id);
      setSelectedProjectIds([generalProject.id]);
      setHasInitialized(true);
    }
  }, [generalProject, hasInitialized]);

  return (
    <div className="flex h-screen bg-white">
      {/* Column 1: Projects/Navigation Panel */}
      <div className="w-64 border-r border-gray-200 flex-shrink-0">
        <ProjectsPanel
          userId={userId}
          selectedProjectIds={selectedProjectIds}
          onProjectSelectionChange={setSelectedProjectIds}
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