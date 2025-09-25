'use client';

interface SavedViewsProps {
  userId: string;
  selectedViewId: string | null;
  onViewChange: (viewId: string | null) => void;
}

// Mock saved views - will integrate with real data later
const mockViews = [
  { id: null, name: 'All Tasks', type: 'list' },
  { id: 'view-1', name: 'My To-Dos', type: 'list' },
  { id: 'view-2', name: 'Work Board', type: 'kanban' },
  { id: 'view-3', name: 'This Week', type: 'list' },
];

export function SavedViews({ userId: _userId, selectedViewId, onViewChange }: SavedViewsProps) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Views</h3>
        <button
          className="text-sm text-blue-600 hover:text-blue-700"
          title="Save current view"
        >
          + Save View
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {mockViews.map((view) => (
          <button
            key={view.id || 'all'}
            onClick={() => onViewChange(view.id)}
            className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors ${
              selectedViewId === view.id
                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-1">
              {view.type === 'kanban' ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 0v10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2z" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              )}
              {view.name}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}