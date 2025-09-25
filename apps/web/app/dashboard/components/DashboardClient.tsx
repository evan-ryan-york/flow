'use client';

import { useState } from 'react';
import { useSupabase } from '@/lib/providers';
import { useRouter } from 'next/navigation';
import { ProjectsPanel } from '@perfect-task-app/ui/custom';
import type { User } from '@supabase/supabase-js';

interface DashboardClientProps {
  user: User;
}

export function DashboardClient({ user }: DashboardClientProps) {
  const supabase = useSupabase();
  const router = useRouter();
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  const handleSignOut = async () => {
    console.log('👋 Signing out...');
    await supabase.auth.signOut();
    router.push('/login');
  };

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

        {/* Column 2: Task Hub (placeholder) */}
        <div className="flex-1 p-6">
          <div className="h-full border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Task Hub</h2>
              <p className="text-gray-600 mb-4">
                Selected projects: {selectedProjectIds.length === 0 ? 'None' : selectedProjectIds.join(', ')}
              </p>
              <p className="text-sm text-gray-500">
                This is where tasks will be displayed based on selected projects
              </p>
            </div>
          </div>
        </div>

        {/* Column 3: Calendar Panel (placeholder) */}
        <div className="w-80 border-l border-gray-200 p-6">
          <div className="h-full border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Calendar</h2>
              <p className="text-sm text-gray-500">
                Calendar and time blocks will be displayed here
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}