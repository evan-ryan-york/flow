'use client';

import { useState } from 'react';
import { ProjectsPanel } from '@flow-app/ui/custom';
import { TaskHub } from '@/components/TaskHub';
import { CalendarPanel } from '@/components/CalendarPanel';
import type { User } from '@supabase/supabase-js';

interface DashboardClientProps {
  user: User;
}

export function DashboardClient({ user }: DashboardClientProps) {
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-white">
      <main className="flex h-screen overflow-hidden">
        {/* Column 1: Projects Panel */}
        <div className="w-64 border-r border-gray-200">
          <ProjectsPanel
            userId={user.id}
            selectedProjectIds={selectedProjectIds}
            onProjectSelectionChange={setSelectedProjectIds}
          />
        </div>

        {/* Column 2: Task Hub */}
        <div className="flex-1">
          <TaskHub
            userId={user.id}
            selectedProjectIds={selectedProjectIds}
            selectedViewId={selectedViewId}
            onViewChange={setSelectedViewId}
          />
        </div>

        {/* Column 3: Calendar Panel */}
        <div className="w-80 border-l border-gray-200">
          <CalendarPanel userId={user.id} />
        </div>
      </main>
    </div>
  );
}