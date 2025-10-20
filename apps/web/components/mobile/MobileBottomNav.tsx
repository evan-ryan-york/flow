'use client';

interface MobileBottomNavProps {
  activeTab: 'tasks' | 'projects' | 'calendar' | 'account';
  onTabChange: (tab: 'tasks' | 'projects' | 'calendar' | 'account') => void;
}

export function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
  const tabs = [
    { id: 'tasks' as const, label: 'Tasks', icon: '📋' },
    { id: 'projects' as const, label: 'Projects', icon: '📁' },
    { id: 'calendar' as const, label: 'Calendar', icon: '📅' },
    { id: 'account' as const, label: 'Account', icon: '👤' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex h-16 items-center justify-around">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex flex-col items-center justify-center
                min-w-[64px] min-h-[48px]
                transition-colors
                ${isActive
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
                }
              `}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="text-2xl mb-1" aria-hidden="true">
                {tab.icon}
              </span>
              <span className={`text-xs font-medium ${isActive ? 'text-blue-600' : 'text-gray-600'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
