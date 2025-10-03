'use client';

import React, { useState, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, startOfDay, endOfDay, addDays } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { useDroppable } from '@dnd-kit/core';
import { useRouter } from 'next/navigation';
import { Settings, RefreshCw } from '@perfect-task-app/ui/components/Calendar/icons';
import { useCalendarEvents, useTriggerEventSync, useGoogleCalendarConnections, useCalendarSubscriptions } from '@perfect-task-app/data/hooks/useCalendar';
import { useCreateTimeBlock, useUserTimeBlocks, useDeleteTimeBlock } from '@perfect-task-app/data';
import type { CalendarEvent, TimeBlock } from '@perfect-task-app/models';
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

// Transform CalendarEvent to react-big-calendar event format
function transformCalendarEvent(event: CalendarEvent) {
  return {
    id: event.id,
    title: event.title,
    start: new Date(event.start_time),
    end: new Date(event.end_time),
    resource: {
      type: 'google-event',
      source: 'google',
      description: event.description,
      location: event.location,
      color: event.color,
      isAllDay: event.is_all_day,
      googleCalendarId: event.google_calendar_id,
    },
  };
}

// Transform TimeBlock to react-big-calendar event format
function transformTimeBlock(timeBlock: TimeBlock) {
  return {
    id: timeBlock.id,
    title: timeBlock.title,
    start: new Date(timeBlock.start_time),
    end: new Date(timeBlock.end_time),
    resource: {
      type: 'work-block',
      tasks: [],
    },
  };
}

export function CalendarPanel({ userId }: CalendarPanelProps) {
  const router = useRouter();
  const [view, setView] = useState<'day' | 'week'>('day');
  const [date, setDate] = useState(new Date());

  const { setNodeRef, isOver } = useDroppable({
    id: 'calendar-panel',
  });

  // Calculate date range based on view and selected date
  const dateRange = useMemo(() => {
    if (view === 'day') {
      return {
        start: startOfDay(date),
        end: endOfDay(date),
      };
    } else {
      // Week view - get 7 days starting from current date
      return {
        start: startOfDay(date),
        end: endOfDay(addDays(date, 6)),
      };
    }
  }, [view, date]);

  // Calculate ISO date range for time blocks
  const isoDateRange = useMemo(() => ({
    start: dateRange.start.toISOString(),
    end: dateRange.end.toISOString(),
  }), [dateRange]);

  // Fetch calendar events
  const { data: calendarEvents = [], isLoading: isLoadingEvents, error: eventsError } = useCalendarEvents(
    dateRange.start,
    dateRange.end,
    { visibleOnly: true }
  );

  // Fetch time blocks
  const { data: timeBlocks = [], isLoading: isLoadingBlocks, error: blocksError } = useUserTimeBlocks(
    userId,
    isoDateRange
  );

  // Fetch calendar connections and subscriptions
  const { data: connections = [] } = useGoogleCalendarConnections();
  const { data: subscriptions = [] } = useCalendarSubscriptions();

  // Event sync mutation
  const triggerEventSync = useTriggerEventSync();

  // Time block mutations
  const createTimeBlock = useCreateTimeBlock();
  const deleteTimeBlock = useDeleteTimeBlock();

  const isLoading = isLoadingEvents || isLoadingBlocks;
  const error = eventsError || blocksError;

  // Debug logging
  React.useEffect(() => {
    console.log('📅 CalendarPanel Debug:', {
      dateRange,
      calendarEventsCount: calendarEvents.length,
      timeBlocksCount: timeBlocks.length,
      isLoading,
      error: error?.message,
      syncPending: triggerEventSync.isPending,
    });
  }, [calendarEvents, timeBlocks, isLoading, error, dateRange]);

  // Trigger automatic event sync when needed
  const [lastAutoSync, setLastAutoSync] = React.useState<Date | null>(null);
  const [previousVisibleCount, setPreviousVisibleCount] = React.useState(0);

  // Count visible calendars
  const visibleCalendarCount = React.useMemo(() => {
    return subscriptions.filter(sub => sub.is_visible).length;
  }, [subscriptions]);

  React.useEffect(() => {
    // Auto-sync conditions:
    // 1. Not currently loading
    // 2. Have at least one connection
    // 3. Haven't auto-synced in the last 5 minutes (or never synced)
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const needsSync = !isLoading &&
                     connections.length > 0 &&
                     (!lastAutoSync || lastAutoSync < fiveMinutesAgo);

    if (needsSync) {
      console.log('🔄 Triggering automatic event sync...', {
        connectionsCount: connections.length,
        eventsCount: calendarEvents.length,
        lastSync: lastAutoSync
      });
      triggerEventSync.mutate(undefined, {
        onSuccess: () => {
          setLastAutoSync(new Date());
        }
      });
    }
  }, [isLoading, connections.length]); // Only depend on loading state and connection count

  // Sync when visible calendars change (user toggles visibility)
  React.useEffect(() => {
    if (previousVisibleCount > 0 && visibleCalendarCount > previousVisibleCount) {
      console.log('🔄 New calendar made visible, triggering sync...', {
        previousCount: previousVisibleCount,
        currentCount: visibleCalendarCount
      });
      triggerEventSync.mutate(undefined);
    }
    setPreviousVisibleCount(visibleCalendarCount);
  }, [visibleCalendarCount]);

  // Transform and merge events for react-big-calendar
  const events = useMemo(() => {
    const googleEvents = calendarEvents.map(transformCalendarEvent);
    const workBlocks = timeBlocks.map(transformTimeBlock);
    return [...googleEvents, ...workBlocks];
  }, [calendarEvents, timeBlocks]);

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    // Create new work time block
    const title = prompt('Enter work block title:');
    if (title) {
      createTimeBlock.mutate({
        title,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      }, {
        onSuccess: (newBlock) => {
          console.log('✅ Work block created successfully:', newBlock);
        },
        onError: (error) => {
          console.error('❌ Failed to create work block:', error);
          alert('Failed to create work block. Please try again.');
        },
      });
    }
  };

  const handleSelectEvent = (event: any) => {
    console.log('Selected event:', event);

    // Only allow deletion of work blocks (not Google Calendar events)
    if (event.resource?.type === 'work-block') {
      const confirmDelete = window.confirm(
        `Delete work block "${event.title}"?\n\nThis action cannot be undone.`
      );

      if (confirmDelete) {
        deleteTimeBlock.mutate(event.id, {
          onSuccess: () => {
            console.log('✅ Work block deleted successfully');
          },
          onError: (error) => {
            console.error('❌ Failed to delete work block:', error);
            alert('Failed to delete work block. Please try again.');
          },
        });
      }
    } else if (event.resource?.type === 'google-event') {
      // For Google Calendar events, just show info (no deletion)
      alert(`Google Calendar Event: ${event.title}\n\nTo edit or delete this event, please use Google Calendar.`);
    }
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
          border: '2px solid #1d4ed8',
          fontWeight: '600',
        },
      };
    }

    if (resource?.type === 'google-event') {
      // Use the calendar's color if available, otherwise default to green
      const bgColor = resource.color || '#10b981';

      return {
        style: {
          backgroundColor: bgColor,
          borderColor: bgColor,
          color: 'white',
          borderRadius: '6px',
          border: 'none',
          opacity: resource.isAllDay ? 0.8 : 1,
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
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-900">Calendar</h2>
            <button
              onClick={() => router.push('/app/settings/calendar-connections')}
              className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
              title="Calendar Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={() => triggerEventSync.mutate(undefined)}
              disabled={triggerEventSync.isPending}
              className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50"
              title="Sync Events"
            >
              <RefreshCw className={`h-4 w-4 ${triggerEventSync.isPending ? 'animate-spin' : ''}`} />
            </button>
            {events.length > 0 && (
              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                {events.length}
              </span>
            )}
          </div>
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
      <div className="flex-1 p-4 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
              <span className="text-sm text-gray-600">Loading events...</span>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm z-10">
            Failed to load events. Please try again.
          </div>
        )}
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
        {!isLoading && !error && events.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 text-sm">No events for this {view}</p>
          </div>
        )}
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