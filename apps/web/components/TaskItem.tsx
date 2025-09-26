'use client';

interface TaskItemProps {
  task: {
    id: string;
    name: string;
    description?: string | null;
    status: string;
    due_date?: string | null;
    project_id: string;
  };
  isDragging?: boolean;
}

const projectNames: Record<string, string> = {
  '1': 'General',
  '2': 'Work Projects',
  '3': 'Personal',
  '4': 'Side Hustle',
};

const statusColors: Record<string, string> = {
  'To Do': 'bg-gray-100 text-gray-800',
  'In Progress': 'bg-blue-100 text-blue-800',
  'Done': 'bg-green-100 text-green-800',
};

export function TaskItem({ task, isDragging = false }: TaskItemProps) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Done';

  const handleStatusChange = (newStatus: string) => {
    // TODO: Integrate with real task update service
    console.log('Updating task status:', task.id, newStatus);
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow ${
      isDragging ? 'rotate-2 shadow-lg' : ''
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{task.name}</h3>
          {task.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{task.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 ml-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            statusColors[task.status] || statusColors['To Do']
          }`}>
            {task.status}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 1v4m8-4v4" />
            </svg>
            {projectNames[task.project_id]}
          </span>

          {task.due_date && (
            <span className={`inline-flex items-center ${
              isOverdue ? 'text-red-600 font-medium' : ''
            }`}>
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {new Date(task.due_date).toLocaleDateString()}
              {isOverdue && ' (Overdue)'}
            </span>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1">
          {task.status !== 'Done' && (
            <button
              onClick={() => handleStatusChange('Done')}
              className="p-1 text-gray-400 hover:text-green-600 rounded"
              title="Mark as done"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
          <button
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            title="More options"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}