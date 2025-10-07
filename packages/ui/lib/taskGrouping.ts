import { Task, CustomPropertyDefinition, CustomPropertyValue } from '@perfect-task-app/models';
import { isToday, isTomorrow, startOfWeek, endOfWeek } from 'date-fns';

export type GroupByOption =
  | 'none'
  | 'project'
  | 'dueDate'
  | 'assignee'
  | 'completion'
  | { type: 'customProperty'; definitionId: string };

export interface TaskGroup {
  key: string;
  label: string;
  tasks: Task[];
  count: number;
  completedCount: number;
  sortOrder: number;
}

// Main grouping function
export function groupTasks(
  tasks: Task[],
  groupBy: GroupByOption,
  projects: { id: string; name: string }[] = [],
  profiles: { id: string; first_name?: string | null; last_name?: string | null }[] = [],
  customPropertyDefinition?: CustomPropertyDefinition,
  customPropertyValues?: CustomPropertyValue[]
): TaskGroup[] {
  // Handle custom property grouping
  if (typeof groupBy === 'object' && groupBy.type === 'customProperty') {
    if (!customPropertyDefinition || !customPropertyValues) {
      console.warn('Custom property grouping requires definition and values');
      return [{
        key: 'all',
        label: 'All Tasks',
        tasks,
        count: tasks.length,
        completedCount: tasks.filter(t => t.is_completed).length,
        sortOrder: 0
      }];
    }
    return groupTasksByCustomProperty(tasks, customPropertyDefinition, customPropertyValues);
  }

  // Handle built-in grouping options
  switch (groupBy) {
    case 'project':
      return groupTasksByProject(tasks, projects);
    case 'dueDate':
      return groupTasksByDueDate(tasks);
    case 'assignee':
      return groupTasksByAssignee(tasks, profiles);
    case 'completion':
      return groupTasksByCompletion(tasks);
    case 'none':
    default:
      return [{
        key: 'all',
        label: 'All Tasks',
        tasks,
        count: tasks.length,
        completedCount: tasks.filter(t => t.is_completed).length,
        sortOrder: 0
      }];
  }
}

// Group tasks by project
export function groupTasksByProject(tasks: Task[], projects: { id: string; name: string }[] = []): TaskGroup[] {
  const projectGroups = new Map<string, Task[]>();

  // Initialize groups for each project
  projects.forEach(project => {
    projectGroups.set(project.id, []);
  });

  // Group tasks by project
  tasks.forEach(task => {
    const projectId = task.project_id;
    if (!projectGroups.has(projectId)) {
      projectGroups.set(projectId, []);
    }
    projectGroups.get(projectId)!.push(task);
  });

  // Convert to TaskGroup array - include empty groups
  const groups: TaskGroup[] = [];
  projectGroups.forEach((projectTasks, projectId) => {
    const project = projects.find(p => p.id === projectId);
    groups.push({
      key: projectId,
      label: project?.name || `Project ${projectId}`,
      tasks: projectTasks,
      count: projectTasks.length,
      completedCount: projectTasks.filter(t => t.is_completed).length,
      sortOrder: project?.name ? project.name.charCodeAt(0) : 999
    });
  });

  return groups.sort((a, b) => a.sortOrder - b.sortOrder);
}

// Group tasks by due date
export function groupTasksByDueDate(tasks: Task[]): TaskGroup[] {
  const dueDateGroups = {
    overdue: [] as Task[],
    today: [] as Task[],
    tomorrow: [] as Task[],
    thisWeek: [] as Task[],
    later: [] as Task[],
    noDate: [] as Task[]
  };

  const today = new Date();
  const startOfThisWeek = startOfWeek(today);
  const endOfThisWeek = endOfWeek(today);

  // Group tasks by due date categories
  tasks.forEach(task => {
    const dueDate = task.due_date ? new Date(task.due_date) : null;

    if (!dueDate) {
      dueDateGroups.noDate.push(task);
    } else if (dueDate < today && !isToday(dueDate)) {
      dueDateGroups.overdue.push(task);
    } else if (isToday(dueDate)) {
      dueDateGroups.today.push(task);
    } else if (isTomorrow(dueDate)) {
      dueDateGroups.tomorrow.push(task);
    } else if (dueDate >= startOfThisWeek && dueDate <= endOfThisWeek) {
      dueDateGroups.thisWeek.push(task);
    } else {
      dueDateGroups.later.push(task);
    }
  });

  // Convert to TaskGroup array
  const groups: TaskGroup[] = [];
  const groupOrder = [
    { key: 'overdue', label: 'Overdue', tasks: dueDateGroups.overdue, sortOrder: 0 },
    { key: 'today', label: 'Today', tasks: dueDateGroups.today, sortOrder: 1 },
    { key: 'tomorrow', label: 'Tomorrow', tasks: dueDateGroups.tomorrow, sortOrder: 2 },
    { key: 'thisWeek', label: 'This Week', tasks: dueDateGroups.thisWeek, sortOrder: 3 },
    { key: 'later', label: 'Later', tasks: dueDateGroups.later, sortOrder: 4 },
    { key: 'noDate', label: 'No Due Date', tasks: dueDateGroups.noDate, sortOrder: 5 }
  ];

  // Include all groups, even if empty
  groupOrder.forEach(group => {
    groups.push({
      key: group.key,
      label: group.label,
      tasks: group.tasks,
      count: group.tasks.length,
      completedCount: group.tasks.filter(t => t.is_completed).length,
      sortOrder: group.sortOrder
    });
  });

  return groups;
}

// Group tasks by assignee
export function groupTasksByAssignee(tasks: Task[], profiles: { id: string; first_name?: string | null; last_name?: string | null }[] = []): TaskGroup[] {
  const assigneeGroups = new Map<string, Task[]>();

  // Initialize groups for all profiles and unassigned
  assigneeGroups.set('unassigned', []);
  profiles.forEach(profile => {
    assigneeGroups.set(profile.id, []);
  });

  // Group tasks by assignee
  tasks.forEach(task => {
    const assigneeId = task.assigned_to || 'unassigned';
    if (!assigneeGroups.has(assigneeId)) {
      assigneeGroups.set(assigneeId, []);
    }
    assigneeGroups.get(assigneeId)!.push(task);
  });

  // Convert to TaskGroup array - include all profiles even if empty
  const groups: TaskGroup[] = [];
  assigneeGroups.forEach((assigneeTasks, assigneeId) => {
    let label = 'Unassigned';
    let sortOrder = 999;

    if (assigneeId !== 'unassigned') {
      const profile = profiles.find(p => p.id === assigneeId);
      if (profile) {
        label = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'Unknown User';
        sortOrder = label.charCodeAt(0);
      } else {
        label = 'Unknown User';
      }
    }

    groups.push({
      key: assigneeId,
      label,
      tasks: assigneeTasks,
      count: assigneeTasks.length,
      completedCount: assigneeTasks.filter(t => t.is_completed).length,
      sortOrder
    });
  });

  return groups.sort((a, b) => a.sortOrder - b.sortOrder);
}

// Group tasks by completion status
export function groupTasksByCompletion(tasks: Task[]): TaskGroup[] {
  const incomplete: Task[] = [];
  const completed: Task[] = [];

  tasks.forEach(task => {
    if (task.is_completed) {
      completed.push(task);
    } else {
      incomplete.push(task);
    }
  });

  return [
    {
      key: 'incomplete',
      label: 'Not Completed',
      tasks: incomplete,
      count: incomplete.length,
      completedCount: 0,
      sortOrder: 0
    },
    {
      key: 'completed',
      label: 'Completed',
      tasks: completed,
      count: completed.length,
      completedCount: completed.length,
      sortOrder: 1
    }
  ];
}

// Group tasks by custom property value
export function groupTasksByCustomProperty(
  tasks: Task[],
  propertyDefinition: CustomPropertyDefinition,
  propertyValues: CustomPropertyValue[]
): TaskGroup[] {
  // Create a map of task_id -> value
  const valueMap = new Map<string, string>();
  propertyValues
    .filter(pv => pv.definition_id === propertyDefinition.id)
    .forEach(pv => {
      valueMap.set(pv.task_id, pv.value);
    });

  // Group tasks by their property value
  const groups = new Map<string, Task[]>();

  tasks.forEach(task => {
    const value = valueMap.get(task.id) || '(No Value)';
    if (!groups.has(value)) {
      groups.set(value, []);
    }
    groups.get(value)!.push(task);
  });

  // Convert to TaskGroup array
  const result: TaskGroup[] = [];

  // For 'select' type, use the defined options order - include all options even if empty
  if (propertyDefinition.type === 'select' && Array.isArray(propertyDefinition.options)) {
    propertyDefinition.options.forEach((option: string, index: number) => {
      const tasksForOption = groups.get(option) || [];
      result.push({
        key: option,
        label: option,
        tasks: tasksForOption,
        count: tasksForOption.length,
        completedCount: tasksForOption.filter(t => t.is_completed).length,
        sortOrder: index
      });
    });

    // Always add "No Value" group at the end
    const noValueTasks = groups.get('(No Value)') || [];
    result.push({
      key: '(No Value)',
      label: '(No Value)',
      tasks: noValueTasks,
      count: noValueTasks.length,
      completedCount: noValueTasks.filter(t => t.is_completed).length,
      sortOrder: 9999
    });
  } else {
    // For text/number/date, sort alphabetically/numerically
    const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
      if (a === '(No Value)') return 1;
      if (b === '(No Value)') return -1;

      if (propertyDefinition.type === 'number') {
        const numA = parseFloat(a);
        const numB = parseFloat(b);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
      }
      if (propertyDefinition.type === 'date') {
        const dateA = new Date(a);
        const dateB = new Date(b);
        if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
          return dateA.getTime() - dateB.getTime();
        }
      }
      return a.localeCompare(b);
    });

    sortedKeys.forEach((key, index) => {
      const tasksForKey = groups.get(key)!;
      result.push({
        key,
        label: key,
        tasks: tasksForKey,
        count: tasksForKey.length,
        completedCount: tasksForKey.filter(t => t.is_completed).length,
        sortOrder: index
      });
    });
  }

  return result;
}

// Get available grouping options based on current tasks
export function getAvailableGroupByOptions(
  tasks: Task[],
  selectedProjectIds: string[]
): { value: GroupByOption; label: string; disabled?: boolean }[] {
  const options = [
    { value: 'none' as GroupByOption, label: 'No Grouping' },
    { value: 'dueDate' as GroupByOption, label: 'Group by Due Date' },
    { value: 'assignee' as GroupByOption, label: 'Group by Assignee' }
  ];

  // Only show project grouping when multiple projects are selected
  if (selectedProjectIds.length > 1) {
    options.splice(1, 0, { value: 'project' as GroupByOption, label: 'Group by Project' });
  }

  // Disable options that would create single groups
  const uniqueAssignees = new Set(tasks.map(t => t.assigned_to || 'unassigned'));

  return options.map(option => ({
    ...option,
    disabled:
      (option.value === 'assignee' && uniqueAssignees.size <= 1) ||
      (option.value === 'project' && selectedProjectIds.length <= 1)
  }));
}

// Helper function to get group display color
export function getGroupDisplayColor(groupKey: string, groupBy: GroupByOption): string {
  switch (groupBy) {
    case 'dueDate':
      switch (groupKey) {
        case 'overdue': return 'bg-red-100 text-red-800';
        case 'today': return 'bg-orange-100 text-orange-800';
        case 'tomorrow': return 'bg-yellow-100 text-yellow-800';
        case 'thisWeek': return 'bg-blue-100 text-blue-800';
        case 'later': return 'bg-gray-100 text-gray-800';
        case 'noDate': return 'bg-gray-100 text-gray-500';
        default: return 'bg-gray-100 text-gray-800';
      }

    default:
      return 'bg-gray-100 text-gray-800';
  }
}