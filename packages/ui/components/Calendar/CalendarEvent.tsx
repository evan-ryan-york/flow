"use client"

import * as React from "react"
import type { CalendarEvent as CalendarEventType } from "@flow-app/models"
import { useCalendarSubscriptions } from "@flow-app/data"
import { cn } from "../../lib/utils"

interface CalendarEventProps {
  event: CalendarEventType
  onClick?: (event: CalendarEventType) => void
  className?: string
}

export function CalendarEvent({ event, onClick, className }: CalendarEventProps) {
  const { data: subscriptions } = useCalendarSubscriptions()

  const subscription = subscriptions?.find(s => s.id === event.subscription_id)
  const backgroundColor = event.color || subscription?.background_color || subscription?.calendar_color || '#4285f4'

  const startTime = new Date(event.start_time)
  const endTime = new Date(event.end_time)

  // Calculate duration in minutes
  const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60)

  // Format time display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const handleClick = () => {
    if (onClick) {
      onClick(event)
    }
  }

  return (
    <div
      className={cn(
        "absolute left-0 right-1 rounded px-2 py-1 text-xs overflow-hidden cursor-pointer hover:shadow-lg hover:z-10 transition-shadow",
        className
      )}
      style={{
        backgroundColor,
        top: `${(startTime.getMinutes() / 60) * 100}%`,
        height: `${Math.max((durationMinutes / 60) * 100, 20)}%`,
        opacity: 0.9,
      }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick()
        }
      }}
    >
      <div className="font-semibold text-white truncate" title={event.title}>
        {event.title || '(No title)'}
      </div>

      {!event.is_all_day && durationMinutes > 30 && (
        <div className="text-xs text-white opacity-90 mt-0.5">
          {formatTime(startTime)}
        </div>
      )}

      {event.location && durationMinutes > 60 && (
        <div className="text-xs text-white opacity-75 truncate mt-0.5" title={event.location}>
          {event.location}
        </div>
      )}
    </div>
  )
}
