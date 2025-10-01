'use client';

import { useSupabase } from '@/lib/providers';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

interface AppHeaderProps {
  user: User;
}

export function AppHeader({ user }: AppHeaderProps) {
  const supabase = useSupabase();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Title */}
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">Perfect Task App</h1>
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            <div className="text-sm">
              <div className="font-medium text-gray-900">
                {user.user_metadata.name || user.email}
              </div>
              <div className="text-gray-500">{user.email}</div>
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
  );
}