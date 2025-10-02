"use client"

import * as React from "react"
import { useCalendarEvents, useCalendarEventsRealtime } from "@perfect-task-app/data"
import type { CalendarEvent as CalendarEventType } from "@perfect-task-app/models"
import { CalendarHeader } from "./CalendarHeader"
import { CalendarGrid } from "./CalendarGrid"
import { cn } from "../../lib/utils"

interface CalendarViewProps {
  onEventClick?: (event: CalendarEventType) => void
  className?: string
}

export function CalendarView({ onEventClick, className }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = React.useState(new Date())
  const [viewType, setViewType] = React.useState<'day' | 'week'>('week')

  // Calculate date range based on view type
  const { startDate, endDate } = React.useMemo(() => {
    if (viewType === 'day') {
      const start = new Date(currentDate)
      start.setHours(0, 0, 0, 0)
      const end = new Date(currentDate)
      end.setHours(23, 59, 59, 999)
      return { startDate: start, endDate: end }
    } else {
      // Week view
      const start = new Date(currentDate)
      const day = start.getDay()
      const diff = start.getDate() - day
      start.setDate(diff)
      start.setHours(0, 0, 0, 0)

      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      end.setHours(23, 59, 59, 999)

      return { startDate: start, endDate: end }
    }
  }, [currentDate, viewType])

  // Fetch events in the visible date range, only visible calendars
  const { data: events, isLoading } = useCalendarEvents(
    startDate,
    endDate,
    { visibleOnly: true }
  )

  // Enable real-time updates for the visible date range
  useCalendarEventsRealtime(startDate, endDate)

  const handleDateChange = (newDate: Date) => {
    setCurrentDate(newDate)
  }

  const handleViewTypeChange = (newViewType: 'day' | 'week') => {
    setViewType(newViewType)
  }

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      <CalendarHeader
        currentDate={currentDate}
        viewType={viewType}
        onDateChange={handleDateChange}
        onViewTypeChange={handleViewTypeChange}
      />

      <CalendarGrid
        viewType={viewType}
        currentDate={currentDate}
        events={events || []}
        isLoading={isLoading}
        onEventClick={onEventClick}
      />
    </div>
  )
}
