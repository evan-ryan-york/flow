'use client';

import { useState } from 'react';
import { ProjectsPanel } from './ProjectsPanel';
import { TaskHub } from './TaskHub';
import { CalendarPanel } from './CalendarPanel';

interface ThreeColumnLayoutProps {
  userId: string;
}

export function ThreeColumnLayout({ userId }: ThreeColumnLayoutProps) {
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Column 1: Projects/Navigation Panel */}
      <div className="w-64 bg-white border-r border-gray-200 flex-shrink-0">
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
      <div className="w-96 bg-white border-l border-gray-200 flex-shrink-0">
        <CalendarPanel userId={userId} />
      </div>
    </div>
  );
}