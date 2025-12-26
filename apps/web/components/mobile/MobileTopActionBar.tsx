'use client';

import { Search, Filter, Group } from 'iconoir-react';
import { GroupByOption } from '@flow-app/ui/lib/taskGrouping';

interface MobileTopActionBarProps {
  onSearchOpen: () => void;
  onFilterOpen: () => void;
  onGroupOpen: () => void;
  activeFilterCount: number;
  currentGroupBy: GroupByOption | null;
}

export function MobileTopActionBar({
  onSearchOpen,
  onFilterOpen,
  onGroupOpen,
  activeFilterCount,
  currentGroupBy,
}: MobileTopActionBarProps) {
  // Format group by label for aria-label
  const getGroupByLabel = () => {
    if (!currentGroupBy) return '';
    if (typeof currentGroupBy === 'string') {
      return ` by ${currentGroupBy}`;
    }
    return ` by custom property`;
  };

  return (
    <div className="flex items-center justify-between px-4 h-14 bg-white border-b border-gray-200">
      {/* App Title */}
      <h1 className="text-lg font-semibold text-blue-600">Current</h1>

      {/* Action Icons */}
      <div className="flex items-center gap-2">
        {/* Search Button */}
        <button
          onClick={onSearchOpen}
          className="relative flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Search tasks"
        >
          <Search className="w-6 h-6 text-gray-700" strokeWidth={2} />
        </button>

        {/* Filter Button with Badge */}
        <button
          onClick={onFilterOpen}
          className="relative flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label={`Filter tasks${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}`}
        >
          <Filter className="w-6 h-6 text-gray-700" strokeWidth={2} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold text-white bg-blue-500 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Group Button with Indicator */}
        <button
          onClick={onGroupOpen}
          className={`relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
            currentGroupBy ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-100'
          }`}
          aria-label={`Group tasks${getGroupByLabel()}`}
        >
          <Group className={`w-6 h-6 ${currentGroupBy ? 'text-blue-600' : 'text-gray-700'}`} strokeWidth={2} />
          {currentGroupBy && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white" />
          )}
        </button>
      </div>
    </div>
  );
}
