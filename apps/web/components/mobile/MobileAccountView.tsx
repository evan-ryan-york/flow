'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'iconoir-react';
import { Avatar, AvatarFallback } from '@flow-app/ui/components/ui/avatar';
import { useSignOut, useCurrentUser } from '@flow-app/data';

export function MobileAccountView() {
  const router = useRouter();
  const signOut = useSignOut();
  const { data: user } = useCurrentUser();

  const handleLogout = async () => {
    try {
      await signOut.mutateAsync();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Get user initials for avatar
  const getInitials = () => {
    if (!user?.email) return '?';
    const email = user.email;
    return email.charAt(0).toUpperCase();
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-semibold text-gray-900">Account</h2>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {/* User Avatar and Info */}
        <div className="flex flex-col items-center mb-8">
          <Avatar className="h-20 w-20 mb-4">
            <AvatarFallback className="bg-blue-600 text-white text-2xl font-medium">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <p className="text-base font-medium text-gray-900 mb-1">
            {user?.email || 'User'}
          </p>
          <p className="text-sm text-gray-500">Signed in</p>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          disabled={signOut.isPending}
          className="w-full max-w-xs flex items-center justify-center gap-3 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span className="font-medium">
            {signOut.isPending ? 'Logging out...' : 'Logout'}
          </span>
        </button>
      </div>

      {/* Footer (optional - could add app version, etc) */}
      <div className="flex-shrink-0 p-4 text-center">
        <p className="text-xs text-gray-400">Current</p>
      </div>
    </div>
  );
}
