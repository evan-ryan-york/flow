'use client';

import { useEffect } from 'react';
import { Check, Xmark } from 'iconoir-react';
import { FilterState, FilterOption, getActiveFilterCount, DateRange, CompletionFilter } from '@perfect-task-app/ui/lib/taskFiltering';
import { Button } from '@perfect-task-app/ui/components/ui/button';

interface MobileFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  availableFilters: {
    assignee: FilterOption[];
    dueDate: FilterOption[];
    project: FilterOption[];
    completion: FilterOption[];
    completionTimeframe: FilterOption[];
  };
  selectedFilters: FilterState;
  onChange: (filters: FilterState) => void;
}

export function MobileFilterSheet({
  isOpen,
  onClose,
  availableFilters,
  selectedFilters,
  onChange,
}: MobileFilterSheetProps) {
  const activeFilterCount = getActiveFilterCount(selectedFilters);
  const hasActiveFilters = activeFilterCount > 0;

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

  const handleAssigneeToggle = (value: string | DateRange | CompletionFilter) => {
    if (typeof value !== 'string') return;
    const assignee = value;
    const newAssignees = selectedFilters.assignee.includes(assignee)
      ? selectedFilters.assignee.filter(a => a !== assignee)
      : [...selectedFilters.assignee, assignee];

    onChange({
      ...selectedFilters,
      assignee: newAssignees
    });
  };

  const handleDueDateToggle = (value: string | DateRange | CompletionFilter) => {
    if (typeof value === 'string' || !('type' in value) || (value.type !== 'overdue' && value.type !== 'today' && value.type !== 'thisWeek' && value.type !== 'nextWeek' && value.type !== 'noDate' && value.type !== 'custom')) return;
    const dateRange = value as DateRange;
    const isSelected = selectedFilters.dueDate &&
                      selectedFilters.dueDate.type === dateRange.type;

    onChange({
      ...selectedFilters,
      dueDate: isSelected ? null : dateRange
    });
  };

  const handleProjectToggle = (value: string | DateRange | CompletionFilter) => {
    if (typeof value !== 'string') return;
    const projectId = value;
    const newProjects = selectedFilters.project.includes(projectId)
      ? selectedFilters.project.filter(p => p !== projectId)
      : [...selectedFilters.project, projectId];

    onChange({
      ...selectedFilters,
      project: newProjects
    });
  };

  const handleCompletionToggle = (value: string | DateRange | CompletionFilter) => {
    if (typeof value === 'string' || !('status' in value)) return;
    const completionFilter = value as CompletionFilter;
    const isSelected = selectedFilters.completion &&
                      selectedFilters.completion.status === completionFilter.status &&
                      selectedFilters.completion.timeframe === completionFilter.timeframe;

    onChange({
      ...selectedFilters,
      completion: isSelected ? null : completionFilter
    });
  };

  const clearAllFilters = () => {
    onChange({
      ...selectedFilters,
      assignee: [],
      dueDate: null,
      project: [],
      completion: null
    });
  };

  const FilterSection = ({
    title,
    options,
    selectedValues,
    onToggle,
  }: {
    title: string;
    options: FilterOption[];
    selectedValues: Array<string | DateRange | CompletionFilter>;
    onToggle: (value: FilterOption['value']) => void;
  }) => {
    if (options.length === 0) return null;

    return (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        <div className="space-y-2">
          {options.map((option) => {
            const isSelected = selectedValues.some(val => {
              if (typeof val === 'string' && typeof option.value === 'string') {
                return val === option.value;
              }
              if (typeof val === 'object' && val !== null && typeof option.value === 'object' && option.value !== null) {
                if ('type' in val && 'type' in option.value && !('status' in val) && !('status' in option.value)) {
                  return (val as { type?: string }).type === (option.value as { type?: string }).type;
                }
                if ('status' in val && 'status' in option.value) {
                  const valFilter = val as CompletionFilter;
                  const optionFilter = option.value as CompletionFilter;
                  return valFilter.status === optionFilter.status &&
                         valFilter.timeframe === optionFilter.timeframe;
                }
              }
              return false;
            });

            return (
              <button
                key={option.key}
                onClick={() => onToggle(option.value)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 border-2 rounded flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? 'bg-blue-500 border-blue-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />}
                  </div>
                  <span className={isSelected ? 'font-medium text-gray-900' : 'text-gray-700'}>
                    {option.label}
                  </span>
                </div>
                {option.count !== undefined && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                    {option.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-50 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Filter Tasks</h2>
            {hasActiveFilters && (
              <span className="bg-blue-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5"
              >
                Clear All
              </button>
            )}
            <button
              onClick={onClose}
              className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <Xmark className="w-5 h-5 text-gray-700" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Filter Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-6 pb-4">
            <FilterSection
              title="Assigned To"
              options={availableFilters.assignee}
              selectedValues={selectedFilters.assignee}
              onToggle={handleAssigneeToggle}
            />

            <FilterSection
              title="Due Date"
              options={availableFilters.dueDate}
              selectedValues={selectedFilters.dueDate ? [selectedFilters.dueDate] : []}
              onToggle={handleDueDateToggle}
            />

            {availableFilters.project.length > 1 && (
              <FilterSection
                title="Project"
                options={availableFilters.project}
                selectedValues={selectedFilters.project}
                onToggle={handleProjectToggle}
              />
            )}

            <FilterSection
              title="Completion Status"
              options={availableFilters.completion}
              selectedValues={selectedFilters.completion ? [selectedFilters.completion] : []}
              onToggle={handleCompletionToggle}
            />

            {/* Show timeframe options when completed or all tasks are selected */}
            {selectedFilters.completion &&
             (selectedFilters.completion.status === 'completed' || selectedFilters.completion.status === 'all') && (() => {
               const status = selectedFilters.completion.status;
               const timeframeOptions: FilterOption[] = [
                 { key: 'all-time', label: 'All time', type: 'completion' as const, value: { status, timeframe: 'all-time' } as CompletionFilter },
                 { key: 'last-month', label: 'Last month', type: 'completion' as const, value: { status, timeframe: 'last-month' } as CompletionFilter },
                 { key: 'last-week', label: 'Last week', type: 'completion' as const, value: { status, timeframe: 'last-week' } as CompletionFilter },
               ];

               return (
                 <div className="ml-4 pl-4 border-l-2 border-gray-200">
                   <FilterSection
                     title="Completed Timeframe"
                     options={timeframeOptions}
                     selectedValues={selectedFilters.completion ? [selectedFilters.completion] : []}
                     onToggle={handleCompletionToggle}
                   />
                 </div>
               );
             })()}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-gray-200 bg-gray-50">
          <Button
            onClick={onClose}
            className="w-full h-12 text-base font-medium"
          >
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  );
}
