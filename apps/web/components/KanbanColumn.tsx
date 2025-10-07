'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task, CustomPropertyDefinition, Project, Profile } from '@perfect-task-app/models';
import { SortableKanbanCard } from './SortableKanbanCard';

interface KanbanColumnProps {
  id: string;
  title: string;
  tasks: Task[];
  color: string;
  userId: string;
  projects?: Project[];
  profiles?: Profile[];
  customPropertyDefinitions?: CustomPropertyDefinition[];
}

export function KanbanColumn({
  id,
  title,
  tasks,
  color,
  userId,
  projects = [],
  profiles = [],
  customPropertyDefinitions = [],
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div className="flex flex-col w-80 flex-shrink-0 bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Column Header */}
      <div className={`px-4 py-3 border-b border-gray-200 ${color} rounded-t-lg`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <span className="text-sm text-gray-500 bg-white px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Column Content */}
      <div
        ref={setNodeRef}
        className={`flex-1 p-3 space-y-2 overflow-y-auto min-h-[200px] ${
          isOver ? 'bg-blue-50' : ''
        }`}
      >
        <SortableContext
          items={tasks.map(task => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map(task => (
            <SortableKanbanCard
              key={task.id}
              task={task}
              userId={userId}
              projects={projects}
              profiles={profiles}
            />
          ))}
        </SortableContext>

        {/* Empty State */}
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}
