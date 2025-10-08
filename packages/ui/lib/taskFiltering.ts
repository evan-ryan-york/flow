import { Task } from '@perfect-task-app/models';
import { isAfter, isBefore, isToday, isThisWeek, startOfToday, endOfWeek, subDays } from 'date-fns';

export interface FilterState {
  search: string;
  assignee: string[];
  dueDate: DateRange | null;
  project: string[];
  completion: CompletionFilter | null;
  customProperties: Record<string, string>;
}

export interface DateRange {
  type: 'overdue' | 'today' | 'thisWeek' | 'nextWeek' | 'noDate' | 'custom';
  customStart?: Date;
  customEnd?: Date;
}

export interface CompletionFilter {
  status: 'incomplete' | 'completed' | 'all'; // What to show
  timeframe?: 'all-time' | 'last-month' | 'last-week'; // When status is 'completed' or 'all'
}

export interface FilterOption {
  key: string;
  label: string;
  type: 'assignee' | 'dueDate' | 'project' | 'completion';
  value: string | DateRange | CompletionFilter;
  count?: number;
}

// Main filtering function that applies all filters
export function filterTasks(tasks: Task[], filters: FilterState): Task[] {
  let filtered = [...tasks];

  // Apply text search
  if (filters.search.trim()) {
    filtered = applyTextSearch(filtered, filters.search);
  }

  // Apply assignee filter
  if (filters.assignee.length > 0) {
    filtered = applyAssigneeFilter(filtered, filters.assignee);
  }

  // Apply due date filter
  if (filters.dueDate) {
    filtered = applyDueDateFilter(filtered, filters.dueDate);
  }

  // Apply project filter
  if (filters.project.length > 0) {
    filtered = applyProjectFilter(filtered, filters.project);
  }

  // Apply completion filter
  if (filters.completion) {
    filtered = applyCompletionFilter(filtered, filters.completion);
  }

  // Apply custom property filters
  if (Object.keys(filters.customProperties).length > 0) {
    filtered = applyCustomPropertyFilter(filtered, filters.customProperties);
  }

  return filtered;
}

// Text search across task name and description
export function applyTextSearch(tasks: Task[], query: string): Task[] {
  const searchTerm = query.toLowerCase().trim();
  if (!searchTerm) return tasks;

  return tasks.filter(task => {
    const nameMatch = task.name.toLowerCase().includes(searchTerm);
    const descriptionMatch = task.description?.toLowerCase().includes(searchTerm) || false;
    return nameMatch || descriptionMatch;
  });
}

// Filter by assignee
export function applyAssigneeFilter(tasks: Task[], assignees: string[]): Task[] {
  return tasks.filter(task => {
    if (assignees.includes('unassigned')) {
      return !task.assigned_to || assignees.includes(task.assigned_to || '');
    }
    return task.assigned_to && assignees.includes(task.assigned_to);
  });
}

// Filter by project
export function applyProjectFilter(tasks: Task[], projects: string[]): Task[] {
  return tasks.filter(task => projects.includes(task.project_id));
}

// Filter by due date
export function applyDueDateFilter(tasks: Task[], dateRange: DateRange): Task[] {
  const today = startOfToday();
  const thisWeekEnd = endOfWeek(today);
  const nextWeekStart = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextWeekEnd = endOfWeek(nextWeekStart);

  return tasks.filter(task => {
    const dueDate = task.due_date ? new Date(task.due_date) : null;

    switch (dateRange.type) {
      case 'overdue':
        return dueDate && isBefore(dueDate, today);

      case 'today':
        return dueDate && isToday(dueDate);

      case 'thisWeek':
        return dueDate && isThisWeek(dueDate);

      case 'nextWeek':
        return dueDate &&
               (isAfter(dueDate, thisWeekEnd) || dueDate.getTime() === nextWeekStart.getTime()) &&
               (isBefore(dueDate, nextWeekEnd) || dueDate.getTime() === nextWeekEnd.getTime());

      case 'noDate':
        return !dueDate;

      case 'custom':
        if (!dateRange.customStart || !dateRange.customEnd) return true;
        return dueDate &&
               (isAfter(dueDate, dateRange.customStart) || dueDate.getTime() === dateRange.customStart.getTime()) &&
               (isBefore(dueDate, dateRange.customEnd) || dueDate.getTime() === dateRange.customEnd.getTime());

      default:
        return true;
    }
  });
}

// Filter by completion status
export function applyCompletionFilter(tasks: Task[], completionFilter: CompletionFilter): Task[] {
  const today = startOfToday();
  const oneWeekAgo = subDays(today, 7);
  const oneMonthAgo = subDays(today, 30);

  return tasks.filter(task => {
    // First, filter by completion status
    if (completionFilter.status === 'incomplete') {
      if (task.is_completed) return false;
    } else if (completionFilter.status === 'completed') {
      if (!task.is_completed) return false;
    }
    // 'all' shows both completed and incomplete, so no filter needed here

    // Then, apply timeframe filter if task is completed and timeframe is specified
    if (task.is_completed && completionFilter.timeframe && completionFilter.timeframe !== 'all-time') {
      if (!task.completed_at) return false;

      const completedDate = new Date(task.completed_at);

      if (completionFilter.timeframe === 'last-week') {
        return completedDate >= oneWeekAgo && completedDate <= today;
      } else if (completionFilter.timeframe === 'last-month') {
        return completedDate >= oneMonthAgo && completedDate <= today;
      }
    }

    return true;
  });
}

// Filter by custom properties
export function applyCustomPropertyFilter(tasks: Task[], customFilters: Record<string, string>): Task[] {
  return tasks.filter(task => {
    return Object.entries(customFilters).every(([propertyId, filterValue]) => {
      // This would need to be enhanced based on how custom properties are stored
      // For now, assuming task has a custom_properties field
      const taskValue = (task as Task & { custom_properties?: Record<string, string> }).custom_properties?.[propertyId];

      if (filterValue === null || filterValue === undefined || filterValue === '') {
        return true;
      }

      if (Array.isArray(filterValue)) {
        return filterValue.includes(taskValue);
      }

      return taskValue === filterValue;
    });
  });
}

// Get available filter options from tasks
export function getAvailableFilters(tasks: Task[], profiles: { id: string; first_name?: string | null; last_name?: string | null }[] = []): {
  assignee: FilterOption[];
  dueDate: FilterOption[];
  project: FilterOption[];
  completion: FilterOption[];
} {

  // Get unique assignees
  const assigneeCounts = tasks.reduce((acc, task) => {
    const assignee = task.assigned_to || 'unassigned';
    acc[assignee] = (acc[assignee] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const assigneeOptions: FilterOption[] = Object.entries(assigneeCounts).map(([assigneeId, count]) => {
    const profile = profiles.find(p => p.id === assigneeId);
    const label = assigneeId === 'unassigned' ? 'Unassigned' :
                  profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'Unknown User' :
                  'Unknown User';

    return {
      key: assigneeId,
      label,
      type: 'assignee',
      value: assigneeId,
      count
    };
  });

  // Due date options with counts
  const dueDateCounts = {
    overdue: 0,
    today: 0,
    thisWeek: 0,
    nextWeek: 0,
    noDate: 0
  };

  const today = startOfToday();
  tasks.forEach(task => {
    const dueDate = task.due_date ? new Date(task.due_date) : null;

    if (!dueDate) {
      dueDateCounts.noDate++;
    } else if (isBefore(dueDate, today)) {
      dueDateCounts.overdue++;
    } else if (isToday(dueDate)) {
      dueDateCounts.today++;
    } else if (isThisWeek(dueDate)) {
      dueDateCounts.thisWeek++;
    } else {
      // This is a simplified check for next week
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (isThisWeek(nextWeek) && isThisWeek(dueDate)) {
        dueDateCounts.nextWeek++;
      }
    }
  });

  const dueDateOptions: FilterOption[] = [
    { key: 'overdue', label: 'Overdue', type: 'dueDate' as const, value: { type: 'overdue' } as DateRange, count: dueDateCounts.overdue },
    { key: 'today', label: 'Today', type: 'dueDate' as const, value: { type: 'today' } as DateRange, count: dueDateCounts.today },
    { key: 'thisWeek', label: 'This Week', type: 'dueDate' as const, value: { type: 'thisWeek' } as DateRange, count: dueDateCounts.thisWeek },
    { key: 'nextWeek', label: 'Next Week', type: 'dueDate' as const, value: { type: 'nextWeek' } as DateRange, count: dueDateCounts.nextWeek },
    { key: 'noDate', label: 'No Due Date', type: 'dueDate' as const, value: { type: 'noDate' } as DateRange, count: dueDateCounts.noDate },
  ].filter(option => option.count > 0);

  // Get unique projects
  const projectCounts = tasks.reduce((acc, task) => {
    acc[task.project_id] = (acc[task.project_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const projectOptions: FilterOption[] = Object.entries(projectCounts).map(([projectId, count]) => ({
    key: projectId,
    label: `Project ${projectId}`, // This would be replaced with actual project name
    type: 'project',
    value: projectId,
    count
  }));

  // Completion filter options with counts
  const oneWeekAgo = subDays(today, 7);
  const oneMonthAgo = subDays(today, 30);

  const incompleteCount = tasks.filter(t => !t.is_completed).length;
  const completedCount = tasks.filter(t => t.is_completed).length;
  const allTasksCount = tasks.length;

  const completedLastWeekCount = tasks.filter(t => {
    if (!t.is_completed || !t.completed_at) return false;
    const completedDate = new Date(t.completed_at);
    return completedDate >= oneWeekAgo && completedDate <= today;
  }).length;

  const completedLastMonthCount = tasks.filter(t => {
    if (!t.is_completed || !t.completed_at) return false;
    const completedDate = new Date(t.completed_at);
    return completedDate >= oneMonthAgo && completedDate <= today;
  }).length;

  const completionOptions: FilterOption[] = [
    { key: 'incomplete', label: 'Incomplete only', type: 'completion' as const, value: { status: 'incomplete' } as CompletionFilter, count: incompleteCount },
    { key: 'completed', label: 'Completed only', type: 'completion' as const, value: { status: 'completed', timeframe: 'all-time' } as CompletionFilter, count: completedCount },
    { key: 'all', label: 'All tasks', type: 'completion' as const, value: { status: 'all', timeframe: 'all-time' } as CompletionFilter, count: allTasksCount },
  ].filter(option => (option.count ?? 0) > 0);

  // Timeframe sub-options - will be shown based on the selected completion status
  const timeframeOptions: FilterOption[] = [];

  return {
    assignee: assigneeOptions,
    dueDate: dueDateOptions,
    project: projectOptions,
    completion: completionOptions,
    completionTimeframe: timeframeOptions
  };
}

// Helper function to create empty filter state
export function createEmptyFilterState(): FilterState {
  return {
    search: '',
    assignee: [],
    dueDate: null,
    project: [],
    completion: null,
    customProperties: {}
  };
}

// Helper function to check if any filters are active
export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.assignee.length > 0 ||
    filters.dueDate !== null ||
    filters.project.length > 0 ||
    filters.completion !== null ||
    Object.keys(filters.customProperties).length > 0
  );
}

// Helper function to count active filters
export function getActiveFilterCount(filters: FilterState): number {
  let count = 0;

  if (filters.search.trim()) count++;
  if (filters.assignee.length > 0) count++;
  if (filters.dueDate) count++;
  if (filters.project.length > 0) count++;
  if (filters.completion) count++;
  if (Object.keys(filters.customProperties).length > 0) count++;

  return count;
}