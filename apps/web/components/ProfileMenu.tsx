'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@flow-app/ui/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@flow-app/ui';
import { useSignOut, useCurrentUser } from '@flow-app/data';
import { LogOut } from 'iconoir-react';

export function ProfileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const signOut = useSignOut();
  const { data: user } = useCurrentUser();

  const handleLogout = async () => {
    try {
      await signOut.mutateAsync();
      setIsOpen(false);
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Get user initials for avatar
  const getInitials = () => {
    if (!user?.email) return '?';
    const email = user.email;
    // Get first letter of email
    return email.charAt(0).toUpperCase();
  };

  // Get avatar URL (with fallback to avoid rate limiting)
  const getAvatarUrl = () => {
    // Don't use Google profile pictures to avoid rate limiting
    // Could implement Gravatar or custom avatar upload in the future
    return undefined;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full">
          <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-gray-300 transition-all">
            {getAvatarUrl() && (
              <AvatarImage src={getAvatarUrl()} alt={user?.email || 'User'} />
            )}
            <AvatarFallback className="bg-blue-600 text-white text-sm font-medium">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-0" align="end">
        {/* User Info */}
        <div className="p-3 border-b border-gray-200">
          <p className="text-sm font-medium text-gray-900 truncate">
            {user?.email || 'User'}
          </p>
        </div>

        {/* Menu Items */}
        <div className="p-2">
          <button
            onClick={handleLogout}
            disabled={signOut.isPending}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            <span>{signOut.isPending ? 'Logging out...' : 'Logout'}</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
