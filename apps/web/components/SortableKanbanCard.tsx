'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, Project, Profile } from '@perfect-task-app/models';
import { KanbanCard } from './KanbanCard';

interface SortableKanbanCardProps {
  task: Task;
  userId: string;
  projects?: Project[];
  profiles?: Profile[];
}

export function SortableKanbanCard({
  task,
  userId,
  projects = [],
  profiles = [],
}: SortableKanbanCardProps) {
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
    transition: isDragging ? 'none' : transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={isDragging ? 'z-50' : ''}
    >
      <KanbanCard
        task={task}
        isDragging={isDragging}
        userId={userId}
        projects={projects}
        profiles={profiles}
      />
    </div>
  );
}
