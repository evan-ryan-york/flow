'use client';

import { useState, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { useDroppable } from '@dnd-kit/core';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarPanelProps {
  userId: string;
}

// Mock events data - will integrate with real data later
const mockEvents = [
  {
    id: '1',
    title: 'Team Meeting',
    start: new Date(2025, 8, 24, 10, 0), // Sept 24, 10:00 AM
    end: new Date(2025, 8, 24, 11, 0),   // Sept 24, 11:00 AM
    resource: { type: 'meeting', source: 'google' },
  },
  {
    id: '2',
    title: 'Work Time',
    start: new Date(2025, 8, 24, 14, 0), // Sept 24, 2:00 PM
    end: new Date(2025, 8, 24, 16, 0),   // Sept 24, 4:00 PM
    resource: { type: 'work-block', tasks: ['1'] },
  },
  {
    id: '3',
    title: 'Focus Time',
    start: new Date(2025, 8, 25, 9, 0),  // Sept 25, 9:00 AM
    end: new Date(2025, 8, 25, 11, 0),   // Sept 25, 11:00 AM
    resource: { type: 'work-block', tasks: [] },
  },
];

export function CalendarPanel({ userId: _userId }: CalendarPanelProps) {
  const [view, setView] = useState<'day' | 'week'>('day');
  const [date, setDate] = useState(new Date());

  const { setNodeRef, isOver } = useDroppable({
    id: 'calendar-panel',
  });

  const events = useMemo(() => mockEvents, []);

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    // Create new work time block
    const title = prompt('Enter work block title:');
    if (title) {
      const newEvent = {
        id: `work-${Date.now()}`,
        title,
        start,
        end,
        resource: { type: 'work-block', tasks: [] },
      };
      console.log('Creating work block:', newEvent);
      // TODO: Integrate with real time block creation
    }
  };

  const handleSelectEvent = (event: any) => {
    console.log('Selected event:', event);
    // TODO: Show event details or edit modal
  };

  const eventStyleGetter = (event: any) => {
    const { resource } = event;

    if (resource?.type === 'work-block') {
      return {
        style: {
          backgroundColor: '#3b82f6',
          borderColor: '#2563eb',
          color: 'white',
          borderRadius: '6px',
          border: 'none',
        },
      };
    }

    if (resource?.source === 'google') {
      return {
        style: {
          backgroundColor: '#10b981',
          borderColor: '#059669',
          color: 'white',
          borderRadius: '6px',
          border: 'none',
        },
      };
    }

    return {};
  };

  return (
    <div ref={setNodeRef} className={`h-full flex flex-col ${isOver ? 'dnd-drop-zone' : ''}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Calendar</h2>
          <div className="flex gap-1">
            <button
              onClick={() => setView('day')}
              className={`px-3 py-1 text-sm rounded ${
                view === 'day'
                  ? 'bg-blue-100 text-blue-800'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-3 py-1 text-sm rounded ${
                view === 'week'
                  ? 'bg-blue-100 text-blue-800'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Week
            </button>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() - (view === 'week' ? 7 : 1)))}
            className="p-1 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <span className="font-medium text-gray-900">
            {view === 'day'
              ? format(date, 'EEEE, MMM d')
              : `${format(date, 'MMM d')} - ${format(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 6), 'MMM d')}`
            }
          </span>

          <button
            onClick={() => setDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + (view === 'week' ? 7 : 1)))}
            className="p-1 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 p-4">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          view={view === 'day' ? Views.DAY : Views.WEEK}
          onView={() => {}} // Controlled by our buttons
          date={date}
          onNavigate={setDate}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          selectable
          popup
          eventPropGetter={eventStyleGetter}
          step={15}
          timeslots={4}
          min={new Date(0, 0, 0, 7, 0, 0)} // 7 AM
          max={new Date(0, 0, 0, 22, 0, 0)} // 10 PM
          dayLayoutAlgorithm="no-overlap"
        />
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        <button
          onClick={() => handleSelectSlot({
            start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0),
            end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 10, 0)
          })}
          className="w-full px-3 py-2 text-sm text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50"
        >
          + Add Work Block
        </button>
        <p className="text-xs text-gray-500 text-center">
          Drag tasks here to schedule them
        </p>
      </div>
    </div>
  );
}