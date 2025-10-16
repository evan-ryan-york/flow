'use client';

import React, { useState, memo, useRef, useEffect, useMemo } from 'react';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskItem } from './TaskItem';
import { TaskGroup } from './TaskGroup';
import { Task, CustomPropertyDefinition, Project, Profile } from '@perfect-task-app/models';
import { TaskGroup as TaskGroupType, GroupByOption } from '@perfect-task-app/ui/lib/taskGrouping';

// Built-in columns that can be hidden
export type BuiltInColumn = 'assigned_to' | 'due_date' | 'project' | 'created_at';

// Sort direction
export type SortDirection = 'asc' | 'desc' | null;

// Sort configuration
export interface SortConfig {
  column: string; // Can be built-in column or custom property ID
  direction: SortDirection;
}

interface TaskListProps {
  tasks: Task[];
  selectedProjectIds: string[];
  customPropertyDefinitions?: CustomPropertyDefinition[];
  userId: string;
  isLoading?: boolean;
  isDraggingActive?: boolean;
  // Grouped display support
  groupedTasks?: TaskGroupType[];
  showGroupHeaders?: boolean;
  groupBy?: GroupByOption | null;
  userMapping?: Record<string, string>;
  projectMapping?: Record<string, string>;
  projects?: Project[];
  profiles?: Profile[];
  onTaskEditClick?: (taskId: string) => void;
  // Column visibility - controlled by parent
  visibleColumnIds?: Set<string>;
  visibleBuiltInColumns?: Set<BuiltInColumn>;
  onVisibleColumnIdsChange?: (ids: Set<string>) => void;
  onVisibleBuiltInColumnsChange?: (cols: Set<BuiltInColumn>) => void;
  // Custom property values for sorting
  customPropertyValues?: Array<{ task_id: string; definition_id: string; value: string }>;
}

const BUILT_IN_COLUMNS: { id: BuiltInColumn; label: string }[] = [
  { id: 'assigned_to', label: 'Assigned To' },
  { id: 'due_date', label: 'Due Date' },
  { id: 'project', label: 'Project' },
  { id: 'created_at', label: 'Created' },
];

// Sort menu component - handles both sorting and hiding columns
function SortMenu({
  columnId,
  currentSort,
  onSort,
  onHide,
  canHide = true
}: {
  columnId: string;
  currentSort: SortConfig | null;
  onSort: (column: string, direction: SortDirection) => void;
  onHide: () => void;
  canHide?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: globalThis.MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as globalThis.Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const isSortedAsc = currentSort?.column === columnId && currentSort?.direction === 'asc';
  const isSortedDesc = currentSort?.column === columnId && currentSort?.direction === 'desc';

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`ml-1 transition-colors ${
          isSortedAsc || isSortedDesc ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-36 bg-white rounded-md shadow-lg border border-gray-200 right-0">
          <div className="py-1">
            <button
              onClick={() => {
                onSort(columnId, 'asc');
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 flex items-center gap-2 ${
                isSortedAsc ? 'text-blue-600 font-medium' : 'text-gray-700'
              }`}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
              </svg>
              Sort ascending
            </button>
            <button
              onClick={() => {
                onSort(columnId, 'desc');
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 flex items-center gap-2 ${
                isSortedDesc ? 'text-blue-600 font-medium' : 'text-gray-700'
              }`}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h5a1 1 0 000-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
              </svg>
              Sort descending
            </button>
            {canHide && (
              <>
                <div className="border-t border-gray-200 my-1"></div>
                <button
                  onClick={() => {
                    onHide();
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100"
                >
                  Hide column
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Add column button with dropdown
function AddColumnButton({
  hiddenCustomColumns,
  hiddenBuiltInColumns,
  onShowColumn,
  onShowBuiltInColumn
}: {
  hiddenCustomColumns: CustomPropertyDefinition[];
  hiddenBuiltInColumns: BuiltInColumn[];
  onShowColumn: (columnId: string) => void;
  onShowBuiltInColumn: (columnId: BuiltInColumn) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: globalThis.MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as globalThis.Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const hasHiddenColumns = hiddenCustomColumns.length > 0 || hiddenBuiltInColumns.length > 0;
  if (!hasHiddenColumns) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        title="Add column"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-[100] mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 right-0">
          <div className="py-1 max-h-60 overflow-y-auto">
            <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
              Hidden Columns
            </div>
            {hiddenBuiltInColumns.map((columnId) => {
              const column = BUILT_IN_COLUMNS.find(c => c.id === columnId);
              return (
                <button
                  key={columnId}
                  onClick={() => {
                    onShowBuiltInColumn(columnId);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  {column?.label}
                </button>
              );
            })}
            {hiddenCustomColumns.map((column) => (
              <button
                key={column.id}
                onClick={() => {
                  onShowColumn(column.id);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                {column.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable table headers component
function TableHeaders({
  customPropertyDefinitions,
  visibleColumnIds,
  visibleBuiltInColumns,
  sortConfig,
  onSort,
  onHideColumn,
  onShowColumn,
  onHideBuiltInColumn,
  onShowBuiltInColumn
}: {
  customPropertyDefinitions: CustomPropertyDefinition[];
  visibleColumnIds: Set<string>;
  visibleBuiltInColumns: Set<BuiltInColumn>;
  sortConfig: SortConfig | null;
  onSort: (column: string, direction: SortDirection) => void;
  onHideColumn: (columnId: string) => void;
  onShowColumn: (columnId: string) => void;
  onHideBuiltInColumn: (columnId: BuiltInColumn) => void;
  onShowBuiltInColumn: (columnId: BuiltInColumn) => void;
}) {
  const visibleColumns = customPropertyDefinitions.filter(prop => visibleColumnIds.has(prop.id));
  const hiddenColumns = customPropertyDefinitions.filter(prop => !visibleColumnIds.has(prop.id));
  const hiddenBuiltInColumns = BUILT_IN_COLUMNS.filter(col => !visibleBuiltInColumns.has(col.id)).map(col => col.id);

  return (
    <div className="relative flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
      {/* Spacer for drag handle - exact width of button with p-1 and w-4 icon */}
      <div className="flex-shrink-0" style={{ width: '24px', height: '24px' }}></div>
      {/* Spacer for completion button - exact width of w-5 icon */}
      <div className="flex-shrink-0" style={{ width: '20px', height: '20px' }}></div>
      {/* Name Column */}
      <div className="flex-1 min-w-0 flex items-center">
        <span>Name</span>
        <SortMenu
          columnId="name"
          currentSort={sortConfig}
          onSort={onSort}
          onHide={() => {}}
          canHide={false}
        />
      </div>
      {/* Assigned To Column */}
      {visibleBuiltInColumns.has('assigned_to') && (
        <div className="flex-shrink-0 w-24 flex items-center justify-end">
          <div className="flex items-center text-right">
            <span>Assigned</span>
            <SortMenu
              columnId="assigned_to"
              currentSort={sortConfig}
              onSort={onSort}
              onHide={() => onHideBuiltInColumn('assigned_to')}
            />
          </div>
        </div>
      )}
      {/* Due Date Column */}
      {visibleBuiltInColumns.has('due_date') && (
        <div className="flex-shrink-0 w-28 flex items-center justify-end">
          <div className="flex items-center text-right">
            <span>Due Date</span>
            <SortMenu
              columnId="due_date"
              currentSort={sortConfig}
              onSort={onSort}
              onHide={() => onHideBuiltInColumn('due_date')}
            />
          </div>
        </div>
      )}
      {/* Project Column */}
      {visibleBuiltInColumns.has('project') && (
        <div className="flex-shrink-0 w-28 flex items-center justify-end">
          <div className="flex items-center text-right">
            <span>Project</span>
            <SortMenu
              columnId="project"
              currentSort={sortConfig}
              onSort={onSort}
              onHide={() => onHideBuiltInColumn('project')}
            />
          </div>
        </div>
      )}
      {/* Created Column */}
      {visibleBuiltInColumns.has('created_at') && (
        <div className="flex-shrink-0 w-28 flex items-center justify-end">
          <div className="flex items-center text-right">
            <span>Created</span>
            <SortMenu
              columnId="created_at"
              currentSort={sortConfig}
              onSort={onSort}
              onHide={() => onHideBuiltInColumn('created_at')}
            />
          </div>
        </div>
      )}
      {/* Custom Property Columns */}
      {visibleColumns.map((property) => (
        <div key={property.id} className="flex-shrink-0 w-32 flex items-center justify-end">
          <div className="flex items-center text-right">
            <span>{property.name}</span>
            <SortMenu
              columnId={property.id}
              currentSort={sortConfig}
              onSort={onSort}
              onHide={() => onHideColumn(property.id)}
            />
          </div>
        </div>
      ))}
      {/* Add Column Button - absolutely positioned */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
        <AddColumnButton
          hiddenCustomColumns={hiddenColumns}
          hiddenBuiltInColumns={hiddenBuiltInColumns}
          onShowColumn={onShowColumn}
          onShowBuiltInColumn={onShowBuiltInColumn}
        />
      </div>
    </div>
  );
}

const TaskList = memo(function TaskList({
  tasks,
  selectedProjectIds,
  customPropertyDefinitions = [],
  userId,
  isLoading,
  isDraggingActive,
  groupedTasks,
  showGroupHeaders = false,
  groupBy,
  userMapping = {},
  projectMapping = {},
  projects = [],
  profiles = [],
  onTaskEditClick,
  visibleColumnIds: controlledVisibleColumnIds,
  visibleBuiltInColumns: controlledVisibleBuiltInColumns,
  onVisibleColumnIdsChange,
  onVisibleBuiltInColumnsChange,
  customPropertyValues = []
}: TaskListProps) {
  // State for managing collapsed groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // State for sorting
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // State for column visibility - use controlled if provided, otherwise manage locally
  const [localVisibleColumnIds, setLocalVisibleColumnIds] = useState<Set<string>>(() =>
    new Set(customPropertyDefinitions.map(prop => prop.id))
  );

  const [localVisibleBuiltInColumns, setLocalVisibleBuiltInColumns] = useState<Set<BuiltInColumn>>(() =>
    new Set<BuiltInColumn>(['assigned_to', 'due_date', 'project', 'created_at'])
  );

  // Use controlled state if provided, otherwise use local state
  const visibleColumnIds = controlledVisibleColumnIds ?? localVisibleColumnIds;
  const visibleBuiltInColumns = controlledVisibleBuiltInColumns ?? localVisibleBuiltInColumns;

  const setVisibleColumnIds = (value: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    const newValue = typeof value === 'function' ? value(visibleColumnIds) : value;
    if (onVisibleColumnIdsChange) {
      onVisibleColumnIdsChange(newValue);
    } else {
      setLocalVisibleColumnIds(newValue);
    }
  };

  const setVisibleBuiltInColumns = (value: Set<BuiltInColumn> | ((prev: Set<BuiltInColumn>) => Set<BuiltInColumn>)) => {
    const newValue = typeof value === 'function' ? value(visibleBuiltInColumns) : value;
    if (onVisibleBuiltInColumnsChange) {
      onVisibleBuiltInColumnsChange(newValue);
    } else {
      setLocalVisibleBuiltInColumns(newValue);
    }
  };

  // Update visible columns when custom property definitions change
  useEffect(() => {
    // Check if there are actually new columns before updating
    const hasNewColumns = customPropertyDefinitions.some(prop => !visibleColumnIds.has(prop.id));

    if (hasNewColumns) {
      setVisibleColumnIds(prev => {
        const newSet = new Set(prev);
        customPropertyDefinitions.forEach(prop => {
          if (!prev.has(prop.id)) {
            newSet.add(prop.id); // New columns are visible by default
          }
        });
        return newSet;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customPropertyDefinitions]);

  // Auto-hide the column being grouped by (it's redundant with the group headers)
  useEffect(() => {
    if (!groupBy || groupBy === 'none') return;

    // Handle custom property grouping
    if (typeof groupBy === 'object' && groupBy.type === 'customProperty') {
      const groupedPropertyId = groupBy.definitionId;
      if (visibleColumnIds.has(groupedPropertyId)) {
        setVisibleColumnIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(groupedPropertyId);
          return newSet;
        });
      }
      return;
    }

    // Handle built-in column grouping
    const columnMapping: Record<string, BuiltInColumn> = {
      'project': 'project',
      'assignee': 'assigned_to',
      // 'dueDate' and 'completion' don't have corresponding columns, so we don't hide anything
    };

    const columnToHide = columnMapping[groupBy as string];
    if (columnToHide && visibleBuiltInColumns.has(columnToHide)) {
      setVisibleBuiltInColumns(prev => {
        const newSet = new Set(prev);
        newSet.delete(columnToHide);
        return newSet;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy]);

  const handleToggleCollapse = (groupKey: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  };

  const handleHideColumn = (columnId: string) => {
    setVisibleColumnIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(columnId);
      return newSet;
    });
  };

  const handleShowColumn = (columnId: string) => {
    setVisibleColumnIds(prev => {
      const newSet = new Set(prev);
      newSet.add(columnId);
      return newSet;
    });
  };

  const handleHideBuiltInColumn = (columnId: BuiltInColumn) => {
    setVisibleBuiltInColumns(prev => {
      const newSet = new Set(prev);
      newSet.delete(columnId);
      return newSet;
    });
  };

  const handleShowBuiltInColumn = (columnId: BuiltInColumn) => {
    setVisibleBuiltInColumns(prev => {
      const newSet = new Set(prev);
      newSet.add(columnId);
      return newSet;
    });
  };

  const handleSort = (column: string, direction: SortDirection) => {
    if (direction === null) {
      setSortConfig(null);
    } else {
      setSortConfig({ column, direction });
    }
  };

  // Helper function to get custom property value for a task
  const getCustomPropertyValue = (taskId: string, definitionId: string): string => {
    const propertyValue = customPropertyValues.find(
      pv => pv.task_id === taskId && pv.definition_id === definitionId
    );
    return propertyValue?.value || '';
  };

  // Apply sorting to tasks - MUST BE BEFORE ANY EARLY RETURNS (Rules of Hooks)
  const displayedTasks = useMemo(() => {
    if (!sortConfig) {
      return [...tasks];
    }

    return [...tasks].sort((a, b) => {
      const { column, direction } = sortConfig;
      const multiplier = direction === 'asc' ? 1 : -1;

      // Handle built-in columns
      switch (column) {
        case 'name':
          return multiplier * a.name.localeCompare(b.name);

        case 'due_date': {
          const aDate = a.due_date ? new Date(a.due_date).getTime() : 0;
          const bDate = b.due_date ? new Date(b.due_date).getTime() : 0;
          // Null dates go to the end
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return multiplier * (aDate - bDate);
        }

        case 'assigned_to': {
          const aName = a.assigned_to ? (userMapping[a.assigned_to] || '') : '';
          const bName = b.assigned_to ? (userMapping[b.assigned_to] || '') : '';
          // Unassigned tasks go to the end
          if (!aName && !bName) return 0;
          if (!aName) return 1;
          if (!bName) return -1;
          return multiplier * aName.localeCompare(bName);
        }

        case 'project': {
          const aProject = projects.find(p => p.id === a.project_id);
          const bProject = projects.find(p => p.id === b.project_id);
          const aName = aProject?.name || '';
          const bName = bProject?.name || '';
          if (!aName && !bName) return 0;
          if (!aName) return 1;
          if (!bName) return -1;
          return multiplier * aName.localeCompare(bName);
        }

        case 'created_at': {
          const aDate = new Date(a.created_at).getTime();
          const bDate = new Date(b.created_at).getTime();
          return multiplier * (aDate - bDate);
        }

        default: {
          // Handle custom property sorting
          const aValue = getCustomPropertyValue(a.id, column);
          const bValue = getCustomPropertyValue(b.id, column);

          // Find property definition to determine type
          const propertyDef = customPropertyDefinitions.find(def => def.id === column);

          if (!propertyDef) return 0;

          // Empty values go to the end
          if (!aValue && !bValue) return 0;
          if (!aValue) return 1;
          if (!bValue) return -1;

          // Sort based on property type
          switch (propertyDef.type) {
            case 'number':
              return multiplier * (parseFloat(aValue) - parseFloat(bValue));

            case 'date': {
              const aDate = new Date(aValue).getTime();
              const bDate = new Date(bValue).getTime();
              return multiplier * (aDate - bDate);
            }

            default:
              // Text and select sorting
              return multiplier * aValue.localeCompare(bValue);
          }
        }
      }
    });
  }, [tasks, sortConfig, userMapping, projects, customPropertyDefinitions, customPropertyValues]);

  // Filter visible columns
  const visibleColumns = customPropertyDefinitions.filter(prop => visibleColumnIds.has(prop.id));

  // Determine if we should show grouped or flat display
  const shouldShowGrouped = showGroupHeaders && groupedTasks && groupedTasks.length > 1;

  // ALL HOOKS CALLED ABOVE - NOW SAFE TO HAVE EARLY RETURNS

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-3 text-sm">Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="mt-2 text-sm">
            {selectedProjectIds.length > 0 ? 'No tasks in selected projects' : 'No tasks yet'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Create your first task using the form above
          </p>
        </div>
      </div>
    );
  }

  if (shouldShowGrouped) {
    // Render grouped tasks with table headers
    return (
      <div className="flex flex-col h-full">
        <TableHeaders
          customPropertyDefinitions={customPropertyDefinitions}
          visibleColumnIds={visibleColumnIds}
          visibleBuiltInColumns={visibleBuiltInColumns}
          sortConfig={sortConfig}
          onSort={handleSort}
          onHideColumn={handleHideColumn}
          onShowColumn={handleShowColumn}
          onHideBuiltInColumn={handleHideBuiltInColumn}
          onShowBuiltInColumn={handleShowBuiltInColumn}
        />

        {/* Grouped Tasks */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {groupedTasks!.map((group) => (
            <TaskGroup
              key={group.key}
              group={group}
              customPropertyDefinitions={visibleColumns}
              userId={userId}
              isCollapsed={collapsedGroups.has(group.key)}
              onToggleCollapse={handleToggleCollapse}
              isDraggingActive={isDraggingActive}
              groupBy={groupBy}
              userMapping={userMapping}
              projectMapping={projectMapping}
              projects={projects}
              profiles={profiles}
              visibleBuiltInColumns={visibleBuiltInColumns}
              onTaskEditClick={onTaskEditClick}
            />
          ))}
        </div>
      </div>
    );
  }

  // Render flat task list (original layout)
  return (
    <div className="flex flex-col h-full">
      <TableHeaders
        customPropertyDefinitions={customPropertyDefinitions}
        visibleColumnIds={visibleColumnIds}
        visibleBuiltInColumns={visibleBuiltInColumns}
        sortConfig={sortConfig}
        onSort={handleSort}
        onHideColumn={handleHideColumn}
        onShowColumn={handleShowColumn}
        onHideBuiltInColumn={handleHideBuiltInColumn}
        onShowBuiltInColumn={handleShowBuiltInColumn}
      />

      {/* Task Rows */}
      <div className="flex-1 overflow-y-auto bg-white">
        <SortableContext
          items={displayedTasks.map(task => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {displayedTasks.map((task) => (
            <SortableTaskItem key={task.id} task={task} customPropertyDefinitions={visibleColumns} userId={userId} userMapping={userMapping} projectMapping={projectMapping} projects={projects} profiles={profiles} visibleBuiltInColumns={visibleBuiltInColumns} onTaskEditClick={onTaskEditClick} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
});

export { TaskList };

function SortableTaskItem({ task, customPropertyDefinitions, userId, userMapping, projectMapping, projects, profiles, visibleBuiltInColumns, onTaskEditClick }: { task: Task; customPropertyDefinitions: CustomPropertyDefinition[]; userId: string; userMapping?: Record<string, string>; projectMapping?: Record<string, string>; projects?: Project[]; profiles?: Profile[]; visibleBuiltInColumns: Set<BuiltInColumn>; onTaskEditClick?: (taskId: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition, // Disable transition while dragging for smoother feel
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? 'opacity-40 z-50' : ''} ${
        transform ? 'shadow-lg' : ''
      }`}
    >
      <TaskItem
        task={task}
        customPropertyDefinitions={customPropertyDefinitions}
        userId={userId}
        isDragging={isDragging}
        dragAttributes={attributes as unknown as Record<string, unknown> & { [key: string]: unknown }}
        dragListeners={listeners as unknown as Record<string, unknown> & { [key: string]: unknown }}
        userMapping={userMapping}
        projectMapping={projectMapping}
        projects={projects}
        profiles={profiles}
        visibleBuiltInColumns={visibleBuiltInColumns}
        onEditClick={onTaskEditClick}
      />
    </div>
  );
}