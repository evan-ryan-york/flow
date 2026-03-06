'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@flow-app/ui/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@flow-app/ui';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@flow-app/ui';
import { Input } from '@flow-app/ui';
import { useSignOut, useCurrentUser, useDeleteAccount } from '@flow-app/data';
import { LogOut, Trash } from 'iconoir-react';

export function ProfileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const router = useRouter();
  const signOut = useSignOut();
  const deleteAccount = useDeleteAccount();
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

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount.mutateAsync();
      setShowDeleteConfirm(false);
      setIsOpen(false);
      router.push('/login');
    } catch (error) {
      console.error('Account deletion failed:', error);
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
    <>
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
            <button
              onClick={() => {
                setIsOpen(false);
                setShowDeleteConfirm(true);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
              <Trash className="h-4 w-4" />
              <span>Delete Account</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              This action is permanent and cannot be undone. All your data including tasks, projects, and settings will be permanently deleted.
              <br /><br />
              Type <strong>DELETE</strong> below to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== 'DELETE' || deleteAccount.isPending}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
            >
              {deleteAccount.isPending ? 'Deleting...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
