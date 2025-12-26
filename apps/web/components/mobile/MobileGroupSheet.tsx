'use client';

import { useEffect } from 'react';
import { Check, Xmark } from 'iconoir-react';
import { GroupByOption, getAvailableGroupByOptions } from '@flow-app/ui/lib/taskGrouping';
import { Task, CustomPropertyDefinition } from '@flow-app/models';
import { Button } from '@flow-app/ui/components/ui/button';

interface MobileGroupSheetProps {
  isOpen: boolean;
  onClose: () => void;
  value: GroupByOption | null;
  onChange: (groupBy: GroupByOption | null) => void;
  tasks: Task[];
  selectedProjectIds: string[];
  customPropertyDefinitions: CustomPropertyDefinition[];
}

export function MobileGroupSheet({
  isOpen,
  onClose,
  value,
  onChange,
  tasks,
  selectedProjectIds,
  customPropertyDefinitions,
}: MobileGroupSheetProps) {
  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: Event) => {
      if ('key' in e && (e as { key: string }).key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const availableOptions = getAvailableGroupByOptions(tasks, selectedProjectIds);

  // Add custom property options (only select and date types for better UX)
  const customPropertyOptions = customPropertyDefinitions
    .filter(prop => prop.type === 'select' || prop.type === 'date')
    .map(prop => ({
      value: { type: 'customProperty' as const, definitionId: prop.id },
      label: prop.name,
      disabled: false
    }));

  const allOptions = [...availableOptions, ...customPropertyOptions];

  const handleOptionSelect = (option: GroupByOption) => {
    const newValue = option === 'none' ? null : option;
    onChange(newValue);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-50 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[75vh] flex flex-col animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Group Tasks</h2>
            <p className="text-sm text-gray-500 mt-0.5">Organize tasks by category</p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <Xmark className="w-5 h-5 text-gray-700" strokeWidth={2} />
          </button>
        </div>

        {/* Group Options Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-2 pb-4">
            {allOptions.map((option) => {
              // Determine if this option is selected
              let isSelected = false;
              if (typeof option.value === 'object' && option.value !== null && option.value.type === 'customProperty') {
                isSelected = typeof value === 'object' && value !== null && value.type === 'customProperty' && value.definitionId === option.value.definitionId;
              } else {
                isSelected = (value || 'none') === option.value;
              }

              // Generate unique key
              const key = typeof option.value === 'object' && option.value !== null
                ? `custom-${option.value.definitionId}`
                : String(option.value);

              return (
                <button
                  key={key}
                  onClick={() => !option.disabled && handleOptionSelect(option.value)}
                  disabled={option.disabled}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm bg-white border-2 rounded-lg transition-all ${
                    option.disabled
                      ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                      : isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 active:bg-blue-100/50'
                  }`}
                >
                  <div
                    className={`w-5 h-5 border-2 rounded-full flex items-center justify-center flex-shrink-0 ${
                      option.disabled
                        ? 'border-gray-200'
                        : isSelected
                        ? 'bg-blue-500 border-blue-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {isSelected && !option.disabled && (
                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                    )}
                  </div>

                  <span className={`flex-1 text-left ${
                    option.disabled
                      ? 'text-gray-400'
                      : isSelected
                      ? 'font-medium text-gray-900'
                      : 'text-gray-700'
                  }`}>
                    {option.label}
                  </span>

                  {option.disabled && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                      N/A
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer with tip */}
        <div className="px-4 py-4 border-t border-gray-200 bg-gray-50">
          <div className="mb-3">
            <p className="text-xs text-gray-500 text-center">
              Grouping organizes tasks into collapsible sections for better organization
            </p>
          </div>
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full h-12 text-base font-medium"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
