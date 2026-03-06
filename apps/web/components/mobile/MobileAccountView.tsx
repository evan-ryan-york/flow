'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Trash } from 'iconoir-react';
import { Avatar, AvatarFallback } from '@flow-app/ui/components/ui/avatar';
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

export function MobileAccountView() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const router = useRouter();
  const signOut = useSignOut();
  const deleteAccount = useDeleteAccount();
  const { data: user } = useCurrentUser();

  const handleLogout = async () => {
    try {
      await signOut.mutateAsync();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount.mutateAsync();
      setShowDeleteConfirm(false);
      router.push('/login');
    } catch (error) {
      console.error('Account deletion failed:', error);
    }
  };

  // Get user initials for avatar
  const getInitials = () => {
    if (!user?.email) return '?';
    const email = user.email;
    return email.charAt(0).toUpperCase();
  };

  return (
    <>
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
            className="w-full max-w-xs flex items-center justify-center gap-3 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-4"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">
              {signOut.isPending ? 'Logging out...' : 'Logout'}
            </span>
          </button>

          {/* Delete Account Button */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full max-w-xs flex items-center justify-center gap-3 px-6 py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 active:bg-red-100 transition-colors"
          >
            <Trash className="h-5 w-5" />
            <span className="font-medium">Delete Account</span>
          </button>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 text-center">
          <p className="text-xs text-gray-400">Flow</p>
        </div>
      </div>

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
