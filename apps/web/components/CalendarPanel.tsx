'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay, startOfDay, endOfDay, addDays } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { Settings, RefreshCw } from '@perfect-task-app/ui/components/Calendar/icons';
import { TimeBlockEvent } from '@perfect-task-app/ui/components/Calendar/TimeBlockEvent';
import { useCalendarEvents, useTriggerEventSync, useGoogleCalendarConnections, useCalendarSubscriptions } from '@perfect-task-app/data/hooks/useCalendar';
import { useCreateTimeBlock, useUserTimeBlocks, useDeleteTimeBlock } from '@perfect-task-app/data';
import { useAssignTaskToTimeBlock } from '@perfect-task-app/data/hooks/useTimeBlockTasks';
import type { CalendarEvent, TimeBlock, Task } from '@perfect-task-app/models';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

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

// Define event types for react-big-calendar
interface CalendarEventResource {
  type: 'google-event' | 'work-block';
  source?: string;
  description?: string | null;
  location?: string | null;
  color?: string;
  isAllDay?: boolean;
  googleCalendarId?: string;
  tasks?: Task[];
  onTaskChange?: () => void;
}

interface CalendarEventType {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource?: CalendarEventResource;
}

// Create drag-and-drop enabled calendar with proper typing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DnDCalendar = withDragAndDrop<CalendarEventType>(Calendar as any);

interface CalendarPanelProps {
  userId: string;
}

// Calculate the relative luminance of a color (WCAG formula)
function getRelativeLuminance(hex: string): number {
  // Remove # if present
  const cleanHex = hex.replace('#', '');

  // Parse RGB
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  // Apply gamma correction
  const [rs, gs, bs] = [r, g, b].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );

  // Calculate relative luminance
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Determine if white or black text has better contrast on a given background color
function getTextColor(backgroundColor: string): string {
  const luminance = getRelativeLuminance(backgroundColor);
  // If background is light (luminance > 0.5), use black text. Otherwise use white.
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// Transform CalendarEvent to react-big-calendar event format
function transformCalendarEvent(event: CalendarEvent): CalendarEventType {
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
      color: event.color || '#059669', // Use the color from DB (user-customizable)
      isAllDay: event.is_all_day,
      googleCalendarId: event.google_calendar_id,
    },
  };
}

// Transform TimeBlock to react-big-calendar event format
function transformTimeBlock(timeBlock: TimeBlock, onTaskChange?: () => void): CalendarEventType {
  return {
    id: timeBlock.id,
    title: timeBlock.title,
    start: new Date(timeBlock.start_time),
    end: new Date(timeBlock.end_time),
    resource: {
      type: 'work-block',
      tasks: [],
      onTaskChange, // Callback to trigger calendar re-render
    },
  };
}

export function CalendarPanel({ userId }: CalendarPanelProps) {
  const router = useRouter();
  const [view, setView] = useState<'day' | 'week'>('day');
  const [date, setDate] = useState(new Date());
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

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
  const assignTaskMutation = useAssignTaskToTimeBlock();

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
  }, [calendarEvents, timeBlocks, isLoading, error, dateRange, triggerEventSync.isPending]);

  // Trigger automatic event sync every 5 minutes
  const lastAutoSyncRef = React.useRef<Date | null>(null);
  const [previousVisibleCount, setPreviousVisibleCount] = React.useState(0);

  // Count visible calendars
  const visibleCalendarCount = React.useMemo(() => {
    return subscriptions.filter(sub => sub.is_visible).length;
  }, [subscriptions]);

  // Automatic sync on mount only (syncs visible subscriptions only to avoid timeout)
  React.useEffect(() => {
    if (connections.length === 0 || isLoading) return;
    if (lastAutoSyncRef.current) return; // Only sync once

    console.log('🔄 Initial automatic event sync (visible calendars only)...');
    triggerEventSync.mutate(undefined, {
      onSuccess: (result) => {
        console.log('🔄 Sync completed:', result);
        lastAutoSyncRef.current = new Date();
      },
      onError: (error) => {
        console.error('🔄 Sync failed:', error);
        lastAutoSyncRef.current = new Date(); // Mark as attempted even on failure to prevent infinite retries
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections.length, isLoading]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCalendarCount, previousVisibleCount]);

  // Listen for task drag events from Task Hub
  React.useEffect(() => {
    const handleTaskDragStart = (e: Event) => {
      const customEvent = e as CustomEvent<Task>;
      setDraggedTask(customEvent.detail);
      console.log('🎯 Task drag started:', customEvent.detail.name);
    };

    const handleTaskDragEnd = () => {
      setDraggedTask(null);
      console.log('🎯 Task drag ended');
    };

    window.addEventListener('task-drag-start', handleTaskDragStart);
    window.addEventListener('task-drag-end', handleTaskDragEnd);

    return () => {
      window.removeEventListener('task-drag-start', handleTaskDragStart);
      window.removeEventListener('task-drag-end', handleTaskDragEnd);
    };
  }, []);

  // State to force calendar re-render when tasks change
  const [calendarKey, setCalendarKey] = useState(0);

  // Callback to force calendar re-render when tasks change (stable reference)
  const handleTaskChange = useCallback(() => {
    console.log('🔄 handleTaskChange called - forcing calendar re-render');
    setCalendarKey(prev => {
      const newKey = prev + 1;
      console.log('🔄 Calendar key updated:', prev, '->', newKey);
      return newKey;
    });
  }, []);

  // Transform and merge events for react-big-calendar
  const events = useMemo(() => {
    const googleEvents = calendarEvents.map(transformCalendarEvent);
    const workBlocks = timeBlocks.map(block => transformTimeBlock(block, handleTaskChange));
    return [...googleEvents, ...workBlocks];
  }, [calendarEvents, timeBlocks, handleTaskChange]);

  // Required by react-big-calendar DnD - we don't need this for our use case
  // We use onDropFromOutside directly
  const dragFromOutsideItem = undefined;

  // Handle dropping a task onto the calendar
  const handleDropFromOutside = ({ start, end }: { start: Date | string; end: Date | string }) => {
    if (!draggedTask) {
      console.log('⚠️ No task being dragged');
      return;
    }

    const dropStart = new Date(start);
    const _dropEnd = new Date(end);

    // Find if there's an existing work block at this time
    const existingBlock = timeBlocks.find(block => {
      const blockStart = new Date(block.start_time);
      const blockEnd = new Date(block.end_time);
      // Check if the drop overlaps with this block
      return dropStart >= blockStart && dropStart < blockEnd;
    });

    if (existingBlock) {
      // Assign task to existing block
      console.log('✅ Assigning task to existing block:', existingBlock.title);
      assignTaskMutation.mutate({
        taskId: draggedTask.id,
        timeBlockId: existingBlock.id,
      }, {
        onSuccess: () => {
          console.log('✅ Task assigned successfully');
          // Force calendar re-render to show new task
          setCalendarKey(prev => prev + 1);
        },
        onError: (error) => {
          console.error('❌ Failed to assign task:', error);
          alert('Failed to assign task. Please try again.');
        },
      });
    } else {
      // No work block at this time - do nothing per requirements
      console.log('⚠️ No work block at drop location - ignoring drop');
      alert('Please drop the task on an existing work block. Create a work block first.');
    }

    setDraggedTask(null);
  };

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

  const handleSelectEvent = (event: CalendarEventType) => {
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

  const eventStyleGetter = (event: CalendarEventType) => {
    const { resource } = event;

    if (resource?.type === 'work-block') {
      const bgColor = '#3b82f6';
      return {
        style: {
          backgroundColor: bgColor,
          borderColor: '#2563eb',
          color: getTextColor(bgColor),
          borderRadius: '6px',
          border: '2px solid #1d4ed8',
          fontWeight: '600',
        },
      };
    }

    if (resource?.type === 'google-event') {
      // Use the calendar's color if available, otherwise default to a darker green for better contrast
      const bgColor = resource.color || '#059669';

      return {
        style: {
          backgroundColor: bgColor,
          borderColor: bgColor,
          color: getTextColor(bgColor),
          borderRadius: '6px',
          border: 'none',
          opacity: resource.isAllDay ? 0.8 : 1,
          fontWeight: '500',
        },
      };
    }

    return {};
  };

  return (
    <div className="h-full flex flex-col">
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
      <div className="flex-1 p-4 relative overflow-hidden">
        <style>{`
          .rbc-timeslot-group {
            min-height: 60px !important;
          }
          .rbc-time-slot {
            min-height: 15px !important;
          }
          .rbc-day-slot .rbc-time-slot {
            background-color: white !important;
          }
          .rbc-time-view {
            background-color: white !important;
          }
          .rbc-time-content {
            background-color: white !important;
          }
          /* Match app fonts */
          .rbc-calendar {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
          }
          .rbc-header {
            font-weight: 600 !important;
            font-size: 0.875rem !important;
            color: #111827 !important;
          }
          .rbc-time-header-content {
            font-weight: 500 !important;
          }
          .rbc-label {
            font-size: 0.75rem !important;
            font-weight: 400 !important;
            color: #6b7280 !important;
          }
          .rbc-event {
            font-size: 0.875rem !important;
            font-weight: 500 !important;
          }
        `}</style>
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
        <DnDCalendar
          key={calendarKey}
          localizer={localizer}
          events={events}
          startAccessor={(event: CalendarEventType) => event.start}
          endAccessor={(event: CalendarEventType) => event.end}
          style={{ height: '100%' }}
          view={view === 'day' ? Views.DAY : Views.WEEK}
          onView={() => {}} // Controlled by our buttons
          date={date}
          onNavigate={setDate}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          selectable
          popup
          toolbar={false}
          eventPropGetter={eventStyleGetter}
          step={15}
          timeslots={4}
          scrollToTime={new Date(0, 0, 0, 7, 0, 0)} // Scroll to 7 AM on load
          dayLayoutAlgorithm="no-overlap"
          // Drag and drop props
          onDropFromOutside={handleDropFromOutside}
          dragFromOutsideItem={dragFromOutsideItem}
          onDragOver={(e: React.DragEvent) => e.preventDefault()}
          draggableAccessor={() => false} // Disable dragging of calendar events
          // Custom event component
          components={{
            event: (props: { event: CalendarEventType }) => {
              if (props.event.resource?.type === 'work-block') {
                return <TimeBlockEvent event={props.event} />;
              }
              // Default rendering for Google Calendar events
              return <div>{props.event.title}</div>;
            },
          }}
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