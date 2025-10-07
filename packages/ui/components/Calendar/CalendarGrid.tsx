"use client"

import * as React from "react"
import type { CalendarEvent as CalendarEventType } from "@perfect-task-app/models"
import { CalendarEvent } from "./CalendarEvent"
import { cn } from "../../lib/utils"

interface CalendarGridProps {
  viewType: 'day' | 'week'
  currentDate: Date
  events: CalendarEventType[]
  isLoading?: boolean
  onEventClick?: (event: CalendarEventType) => void
  className?: string
}

export function CalendarGrid({
  viewType,
  currentDate,
  events,
  isLoading,
  onEventClick,
  className
}: CalendarGridProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i) // 0-23

  // Calculate days to display
  const days = React.useMemo(() => {
    if (viewType === 'day') {
      return [currentDate]
    } else {
      // Week view: Sunday to Saturday
      const startOfWeek = new Date(currentDate)
      const day = startOfWeek.getDay()
      const diff = startOfWeek.getDate() - day
      startOfWeek.setDate(diff)

      return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(startOfWeek)
        date.setDate(date.getDate() + i)
        return date
      })
    }
  }, [viewType, currentDate])

  // Check if a date is today
  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  // Format day display
  const formatDay = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }

  const formatDate = (date: Date) => {
    return date.getDate()
  }

  // Get events for a specific time slot
  const getEventsForSlot = (day: Date, hour: number) => {
    const slotStart = new Date(day)
    slotStart.setHours(hour, 0, 0, 0)
    const slotEnd = new Date(day)
    slotEnd.setHours(hour, 59, 59, 999)

    return events.filter(event => {
      const eventStart = new Date(event.start_time)
      const eventEnd = new Date(event.end_time)

      // Check if event overlaps with this hour slot
      // Event starts before slot ends AND event ends after slot starts
      return eventStart < slotEnd && eventEnd > slotStart
    })
  }

  // Get all-day events for a specific day
  const getAllDayEvents = (day: Date) => {
    const dayStart = new Date(day)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(day)
    dayEnd.setHours(23, 59, 59, 999)

    return events.filter(event => {
      if (!event.is_all_day) return false
      const eventStart = new Date(event.start_time)
      return eventStart >= dayStart && eventStart <= dayEnd
    })
  }

  if (isLoading) {
    return (
      <div className={cn("flex-1 flex items-center justify-center", className)}>
        <div className="text-muted-foreground">Loading events...</div>
      </div>
    )
  }

  return (
    <div className={cn("flex-1 overflow-auto", className)}>
      <div
        className="grid min-w-full"
        style={{
          gridTemplateColumns: `60px repeat(${days.length}, 1fr)`
        }}
      >
        {/* Header row with day names */}
        <div className="sticky top-0 bg-background border-b z-20" />
        {days.map(day => (
          <div
            key={day.toISOString()}
            className="sticky top-0 bg-background border-b border-l p-2 text-center z-20"
          >
            <div className="text-sm text-muted-foreground font-medium">
              {formatDay(day)}
            </div>
            <div className={cn(
              "text-lg font-semibold",
              isToday(day) && "text-primary"
            )}>
              {formatDate(day)}
            </div>
          </div>
        ))}

        {/* All-day events row */}
        <div className="bg-muted/30 border-b text-xs text-muted-foreground p-2 text-right">
          All day
        </div>
        {days.map(day => {
          const allDayEvents = getAllDayEvents(day)
          return (
            <div
              key={`allday-${day.toISOString()}`}
              className="bg-muted/30 border-b border-l p-1 min-h-[60px]"
            >
              <div className="space-y-1">
                {allDayEvents.map(event => (
                  <div
                    key={event.id}
                    className="px-2 py-1 rounded text-xs text-white cursor-pointer hover:shadow-md transition-shadow"
                    style={{
                      backgroundColor: event.color || '#4285f4',
                      opacity: 0.9
                    }}
                    onClick={() => onEventClick?.(event)}
                  >
                    {event.title || '(No title)'}
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* Time slots */}
        {hours.map(hour => (
          <React.Fragment key={hour}>
            <div className="border-r border-b p-2 text-xs text-muted-foreground text-right sticky left-0 bg-background z-10">
              {hour === 0
                ? '12 AM'
                : hour < 12
                ? `${hour} AM`
                : hour === 12
                ? '12 PM'
                : `${hour - 12} PM`}
            </div>

            {days.map(day => {
              const slotEvents = getEventsForSlot(day, hour)

              return (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  className={cn(
                    "border-r border-b relative min-h-[60px]",
                    isToday(day) && "bg-primary/5"
                  )}
                >
                  {slotEvents.map((event, index) => {
                    const eventStart = new Date(event.start_time)
                    const isFirstHourOfEvent = eventStart.getHours() === hour

                    // Only render the event in its starting hour to avoid duplicates
                    if (!isFirstHourOfEvent) return null

                    return (
                      <CalendarEvent
                        key={event.id}
                        event={event}
                        onClick={onEventClick}
                        className="mx-1"
                      />
                    )
                  })}
                </div>
              )
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
