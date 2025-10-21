'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay, startOfDay, endOfDay, addDays } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { RefreshCw } from '@perfect-task-app/ui/components/Calendar/icons';
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

interface MobileCalendarViewProps {
  userId: string;
  view?: 'day' | 'week';
  onViewChange?: (view: 'day' | 'week') => void;
  date?: Date;
  onDateChange?: (date: Date) => void;
  onSettingsClick?: () => void;
  onSyncClick?: () => void;
}

// Calculate the relative luminance of a color (WCAG formula)
function getRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const [rs, gs, bs] = [r, g, b].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Determine if white or black text has better contrast on a given background color
function getTextColor(backgroundColor: string): string {
  const luminance = getRelativeLuminance(backgroundColor);
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
      color: event.color || '#059669',
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
      onTaskChange,
    },
  };
}

export function MobileCalendarView({
  userId,
  view: externalView,
  onViewChange,
  date: externalDate,
  onDateChange,
  onSettingsClick,
  onSyncClick,
}: MobileCalendarViewProps) {
  const router = useRouter();

  // Use internal state if no external control is provided
  const [internalView, setInternalView] = useState<'day' | 'week'>('day');
  const [internalDate, setInternalDate] = useState(new Date());

  const view = externalView ?? internalView;
  const date = externalDate ?? internalDate;

  const _setView = (newView: 'day' | 'week') => {
    if (onViewChange) {
      onViewChange(newView);
    } else {
      setInternalView(newView);
    }
  };

  const handleDateChange = (newDate: Date) => {
    if (onDateChange) {
      onDateChange(newDate);
    } else {
      setInternalDate(newDate);
    }
  };

  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  // Calculate date range based on view and selected date
  const dateRange = useMemo(() => {
    if (view === 'day') {
      return {
        start: startOfDay(date),
        end: endOfDay(date),
      };
    } else {
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
    console.log('📱 MobileCalendarView Debug:', {
      dateRange,
      calendarEventsCount: calendarEvents.length,
      timeBlocksCount: timeBlocks.length,
      isLoading,
      error: error?.message,
    });
  }, [calendarEvents, timeBlocks, isLoading, error, dateRange]);

  // Trigger automatic event sync on mount
  const lastAutoSyncRef = React.useRef<Date | null>(null);
  const [previousVisibleCount, setPreviousVisibleCount] = React.useState(0);

  const visibleCalendarCount = React.useMemo(() => {
    return subscriptions.filter(sub => sub.is_visible).length;
  }, [subscriptions]);

  React.useEffect(() => {
    if (connections.length === 0 || isLoading) return;
    if (lastAutoSyncRef.current) return;

    console.log('🔄 Initial automatic event sync (mobile)...');
    triggerEventSync.mutate(undefined, {
      onSuccess: (result) => {
        console.log('🔄 Sync completed:', result);
        lastAutoSyncRef.current = new Date();
      },
      onError: (error) => {
        console.error('🔄 Sync failed:', error);
        lastAutoSyncRef.current = new Date();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections.length, isLoading]);

  React.useEffect(() => {
    if (previousVisibleCount > 0 && visibleCalendarCount > previousVisibleCount) {
      console.log('🔄 New calendar made visible, triggering sync...');
      triggerEventSync.mutate(undefined);
    }
    setPreviousVisibleCount(visibleCalendarCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCalendarCount, previousVisibleCount]);

  // Listen for task drag events
  React.useEffect(() => {
    const handleTaskDragStart = (e: Event) => {
      const customEvent = e as CustomEvent<Task>;
      setDraggedTask(customEvent.detail);
      console.log('🎯 Task drag started (mobile):', customEvent.detail.name);
    };

    const handleTaskDragEnd = () => {
      setDraggedTask(null);
      console.log('🎯 Task drag ended (mobile)');
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

  const handleTaskChange = useCallback(() => {
    console.log('🔄 handleTaskChange called (mobile)');
    setCalendarKey(prev => prev + 1);
  }, []);

  // Transform and merge events for react-big-calendar
  const events = useMemo(() => {
    const googleEvents = calendarEvents.map(transformCalendarEvent);
    const workBlocks = timeBlocks.map(block => transformTimeBlock(block, handleTaskChange));
    return [...googleEvents, ...workBlocks];
  }, [calendarEvents, timeBlocks, handleTaskChange]);

  const dragFromOutsideItem = useCallback((): CalendarEventType => {
    return {
      id: draggedTask?.id || 'temp',
      title: draggedTask?.name || '',
      start: new Date(),
      end: new Date(),
    };
  }, [draggedTask]);

  const handleDropFromOutside = ({ start, end: _end }: { start: Date | string; end: Date | string }) => {
    if (!draggedTask) {
      console.log('⚠️ No task being dragged');
      return;
    }

    const dropStart = new Date(start);
    const existingBlock = timeBlocks.find(block => {
      const blockStart = new Date(block.start_time);
      const blockEnd = new Date(block.end_time);
      return dropStart >= blockStart && dropStart < blockEnd;
    });

    if (existingBlock) {
      console.log('✅ Assigning task to existing block:', existingBlock.title);
      assignTaskMutation.mutate({
        taskId: draggedTask.id,
        timeBlockId: existingBlock.id,
      }, {
        onSuccess: () => {
          console.log('✅ Task assigned successfully');
          setCalendarKey(prev => prev + 1);
        },
        onError: (error) => {
          console.error('❌ Failed to assign task:', error);
          alert('Failed to assign task. Please try again.');
        },
      });
    } else {
      console.log('⚠️ No work block at drop location');
      alert('Please drop the task on an existing work block. Create a work block first.');
    }

    setDraggedTask(null);
  };

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
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

  const _handleSettingsClick = () => {
    if (onSettingsClick) {
      onSettingsClick();
    } else {
      router.push('/app/settings/calendar-connections');
    }
  };

  const _handleSyncClick = () => {
    if (onSyncClick) {
      onSyncClick();
    } else {
      triggerEventSync.mutate(undefined);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Calendar - Takes remaining space */}
      <div className="flex-1 p-3 relative overflow-hidden bg-white">
        <style>{`
          /* Mobile-optimized calendar styles */
          .rbc-timeslot-group {
            min-height: 70px !important;
          }
          .rbc-time-slot {
            min-height: 17.5px !important;
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
          .rbc-calendar {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
          }
          .rbc-header {
            font-weight: 600 !important;
            font-size: 0.875rem !important;
            color: #111827 !important;
            padding: 8px 4px !important;
          }
          .rbc-label {
            font-size: 0.75rem !important;
            font-weight: 500 !important;
            color: #6b7280 !important;
            padding: 4px !important;
          }
          .rbc-event {
            font-size: 0.875rem !important;
            font-weight: 500 !important;
            padding: 4px 6px !important;
          }
          /* Larger hit areas for mobile */
          .rbc-event-content {
            padding: 2px 0 !important;
          }
        `}</style>
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
              <span className="text-sm text-gray-600">Loading events...</span>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute top-4 left-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm z-10">
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
          onView={() => {}}
          date={date}
          onNavigate={handleDateChange}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          selectable
          popup
          toolbar={false}
          eventPropGetter={eventStyleGetter}
          step={15}
          timeslots={4}
          scrollToTime={new Date(0, 0, 0, 7, 0, 0)}
          dayLayoutAlgorithm="no-overlap"
          onDropFromOutside={handleDropFromOutside}
          dragFromOutsideItem={dragFromOutsideItem}
          onDragOver={(e: React.DragEvent) => e.preventDefault()}
          draggableAccessor={() => false}
          components={{
            event: (props: { event: CalendarEventType }) => {
              if (props.event.resource?.type === 'work-block') {
                return <TimeBlockEvent event={props.event} />;
              }
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

      {/* Quick Actions - Mobile optimized */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white">
        <button
          onClick={() => handleSelectSlot({
            start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0),
            end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 10, 0)
          })}
          className="w-full px-4 py-3 text-sm font-medium text-blue-600 border-2 border-blue-300 rounded-lg hover:bg-blue-50 active:bg-blue-100"
        >
          + Add Work Block
        </button>
        <p className="text-xs text-gray-500 text-center mt-2">
          Tap on the calendar to create time blocks
        </p>
      </div>
    </div>
  );
}
