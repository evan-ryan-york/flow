import { Task } from '@perfect-task-app/models';
import { isToday, isTomorrow, startOfWeek, endOfWeek } from 'date-fns';

export type GroupByOption = 'none' | 'project' | 'status' | 'dueDate' | 'assignee';

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
  projects: any[] = [],
  profiles: any[] = []
): TaskGroup[] {
  switch (groupBy) {
    case 'project':
      return groupTasksByProject(tasks, projects);
    case 'status':
      return groupTasksByStatus(tasks);
    case 'dueDate':
      return groupTasksByDueDate(tasks);
    case 'assignee':
      return groupTasksByAssignee(tasks, profiles);
    case 'none':
    default:
      return [{
        key: 'all',
        label: 'All Tasks',
        tasks,
        count: tasks.length,
        completedCount: tasks.filter(t => t.status === 'Done').length,
        sortOrder: 0
      }];
  }
}

// Group tasks by project
export function groupTasksByProject(tasks: Task[], projects: any[] = []): TaskGroup[] {
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

  // Convert to TaskGroup array
  const groups: TaskGroup[] = [];
  projectGroups.forEach((projectTasks, projectId) => {
    if (projectTasks.length > 0) {
      const project = projects.find(p => p.id === projectId);
      groups.push({
        key: projectId,
        label: project?.name || `Project ${projectId}`,
        tasks: projectTasks,
        count: projectTasks.length,
        completedCount: projectTasks.filter(t => t.status === 'Done').length,
        sortOrder: project?.name ? project.name.charCodeAt(0) : 999
      });
    }
  });

  return groups.sort((a, b) => a.sortOrder - b.sortOrder);
}

// Group tasks by status
export function groupTasksByStatus(tasks: Task[]): TaskGroup[] {
  const statusGroups = new Map<string, Task[]>();
  const statusOrder = ['To-Do', 'In Progress', 'Done']; // Define order

  // Group tasks by status
  tasks.forEach(task => {
    const status = task.status;
    if (!statusGroups.has(status)) {
      statusGroups.set(status, []);
    }
    statusGroups.get(status)!.push(task);
  });

  // Convert to TaskGroup array with proper ordering
  const groups: TaskGroup[] = [];
  statusGroups.forEach((statusTasks, status) => {
    if (statusTasks.length > 0) {
      const sortOrder = statusOrder.indexOf(status);
      groups.push({
        key: status,
        label: status,
        tasks: statusTasks,
        count: statusTasks.length,
        completedCount: statusTasks.filter(t => t.status === 'Done').length,
        sortOrder: sortOrder >= 0 ? sortOrder : 999
      });
    }
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

  groupOrder.forEach(group => {
    if (group.tasks.length > 0) {
      groups.push({
        key: group.key,
        label: group.label,
        tasks: group.tasks,
        count: group.tasks.length,
        completedCount: group.tasks.filter(t => t.status === 'Done').length,
        sortOrder: group.sortOrder
      });
    }
  });

  return groups;
}

// Group tasks by assignee
export function groupTasksByAssignee(tasks: Task[], profiles: any[] = []): TaskGroup[] {
  const assigneeGroups = new Map<string, Task[]>();

  // Group tasks by assignee
  tasks.forEach(task => {
    const assigneeId = task.assigned_to || 'unassigned';
    if (!assigneeGroups.has(assigneeId)) {
      assigneeGroups.set(assigneeId, []);
    }
    assigneeGroups.get(assigneeId)!.push(task);
  });

  // Convert to TaskGroup array
  const groups: TaskGroup[] = [];
  assigneeGroups.forEach((assigneeTasks, assigneeId) => {
    if (assigneeTasks.length > 0) {
      let label = 'Unassigned';
      let sortOrder = 999;

      if (assigneeId !== 'unassigned') {
        const profile = profiles.find(p => p.id === assigneeId);
        if (profile) {
          label = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown User';
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
        completedCount: assigneeTasks.filter(t => t.status === 'Done').length,
        sortOrder
      });
    }
  });

  return groups.sort((a, b) => a.sortOrder - b.sortOrder);
}

// Get available grouping options based on current tasks
export function getAvailableGroupByOptions(
  tasks: Task[],
  selectedProjectIds: string[]
): { value: GroupByOption; label: string; disabled?: boolean }[] {
  const options = [
    { value: 'none' as GroupByOption, label: 'No Grouping' },
    { value: 'status' as GroupByOption, label: 'Group by Status' },
    { value: 'dueDate' as GroupByOption, label: 'Group by Due Date' },
    { value: 'assignee' as GroupByOption, label: 'Group by Assignee' }
  ];

  // Only show project grouping when multiple projects are selected
  if (selectedProjectIds.length > 1) {
    options.splice(1, 0, { value: 'project' as GroupByOption, label: 'Group by Project' });
  }

  // Disable options that would create single groups
  const uniqueStatuses = new Set(tasks.map(t => t.status));
  const uniqueAssignees = new Set(tasks.map(t => t.assigned_to || 'unassigned'));

  return options.map(option => ({
    ...option,
    disabled:
      (option.value === 'status' && uniqueStatuses.size <= 1) ||
      (option.value === 'assignee' && uniqueAssignees.size <= 1) ||
      (option.value === 'project' && selectedProjectIds.length <= 1)
  }));
}

// Helper function to get group display color
export function getGroupDisplayColor(groupKey: string, groupBy: GroupByOption): string {
  switch (groupBy) {
    case 'status':
      switch (groupKey) {
        case 'To-Do': return 'bg-gray-100 text-gray-800';
        case 'In Progress': return 'bg-blue-100 text-blue-800';
        case 'Done': return 'bg-green-100 text-green-800';
        default: return 'bg-gray-100 text-gray-800';
      }

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