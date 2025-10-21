'use client';

import { useEffect, useRef } from 'react';
import { TaskSearchInput } from '../filters/TaskSearchInput';
import { Xmark } from 'iconoir-react';

interface MobileSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalTasks: number;
  filteredTasks: number;
}

export function MobileSearchOverlay({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  totalTasks,
  filteredTasks,
}: MobileSearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when opened
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the overlay is rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: Event) => {
      if ('key' in e && (e as { key: string }).key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when overlay is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-50 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white h-full flex flex-col animate-in slide-in-from-top duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <button
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close search"
          >
            <Xmark className="w-6 h-6 text-gray-700" strokeWidth={2} />
          </button>

          <div className="flex-1">
            <TaskSearchInput
              value={searchQuery}
              onChange={onSearchChange}
              placeholder="Search tasks..."
              totalTasks={totalTasks}
              filteredTasks={filteredTasks}
            />
          </div>
        </div>

        {/* Search Results Info */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          {searchQuery.trim() ? (
            <div className="text-sm text-gray-600">
              {filteredTasks === 0 ? (
                <span className="text-gray-500">No tasks found</span>
              ) : filteredTasks === totalTasks ? (
                <span>
                  Showing all <span className="font-semibold">{totalTasks}</span> task{totalTasks !== 1 ? 's' : ''}
                </span>
              ) : (
                <span>
                  Found <span className="font-semibold text-blue-600">{filteredTasks}</span> of{' '}
                  <span className="font-semibold">{totalTasks}</span> task{totalTasks !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              Enter a search term to filter tasks
            </div>
          )}
        </div>

        {/* Content area - can show search tips or recent searches in the future */}
        <div className="flex-1 overflow-y-auto p-4">
          {!searchQuery.trim() && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Search tips:</p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>Search by task name or description</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>Results update as you type</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>Press ESC to close search</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
