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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Perfect Task App</h1>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                {user.user_metadata?.avatar_url && (
                  <img
                    className="h-8 w-8 rounded-full"
                    src={user.user_metadata.avatar_url}
                    alt={user.user_metadata?.full_name || user.email || 'User'}
                  />
                )}
                <div className="text-sm">
                  <div className="font-medium text-gray-900">
                    {user.user_metadata?.full_name || user.email}
                  </div>
                  <div className="text-gray-500">{user.email}</div>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md hover:bg-gray-100"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Column 1: Projects Panel */}
        <div className="w-64 border-r border-gray-200 bg-white">
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
        <div className="w-80 border-l border-gray-200 bg-white p-6">
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