'use client';

import { useSupabase } from '@/lib/providers';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

interface DashboardClientProps {
  user: User;
}

export function DashboardClient({ user }: DashboardClientProps) {
  const supabase = useSupabase();
  const router = useRouter();

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

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg h-96">
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  🎉 Welcome to Perfect Task App!
                </h2>
                <p className="text-gray-600 mb-6">
                  ✅ You're successfully authenticated! The task management interface will be here.
                </p>
                <div className="text-sm text-gray-500 space-y-1">
                  <p><strong>User ID:</strong> {user.id}</p>
                  <p><strong>Email:</strong> {user.email}</p>
                  <p><strong>Login method:</strong> {user.app_metadata?.provider || 'unknown'}</p>
                  <p><strong>Name:</strong> {user.user_metadata?.full_name || 'Not provided'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}