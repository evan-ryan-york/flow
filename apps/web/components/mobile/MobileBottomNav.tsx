'use client';

import { List, Folder, Calendar, User } from 'iconoir-react';

interface MobileBottomNavProps {
  activeTab: 'tasks' | 'projects' | 'calendar' | 'account';
  onTabChange: (tab: 'tasks' | 'projects' | 'calendar' | 'account') => void;
}

export function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
  const tabs = [
    { id: 'tasks' as const, label: 'Tasks', Icon: List },
    { id: 'projects' as const, label: 'Projects', Icon: Folder },
    { id: 'calendar' as const, label: 'Calendar', Icon: Calendar },
    { id: 'account' as const, label: 'Account', Icon: User },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex h-16 items-center justify-around">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const IconComponent = tab.Icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex flex-col items-center justify-center gap-1
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
              <IconComponent className="w-6 h-6" strokeWidth={isActive ? 2 : 1.5} />
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
