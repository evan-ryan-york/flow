"use client"

import * as React from "react"
import { useTriggerEventSync } from "@perfect-task-app/data"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { ChevronLeft, ChevronRight, RotateCw } from "./icons"

interface CalendarHeaderProps {
  currentDate: Date
  viewType: 'day' | 'week'
  onDateChange: (date: Date) => void
  onViewTypeChange: (type: 'day' | 'week') => void
  className?: string
}

export function CalendarHeader({
  currentDate,
  viewType,
  onDateChange,
  onViewTypeChange,
  className
}: CalendarHeaderProps) {
  const syncEvents = useTriggerEventSync()

  const handlePrevious = () => {
    const newDate = new Date(currentDate)
    if (viewType === 'day') {
      newDate.setDate(newDate.getDate() - 1)
    } else {
      newDate.setDate(newDate.getDate() - 7)
    }
    onDateChange(newDate)
  }

  const handleNext = () => {
    const newDate = new Date(currentDate)
    if (viewType === 'day') {
      newDate.setDate(newDate.getDate() + 1)
    } else {
      newDate.setDate(newDate.getDate() + 7)
    }
    onDateChange(newDate)
  }

  const handleToday = () => {
    onDateChange(new Date())
  }

  const handleSync = () => {
    syncEvents.mutate(undefined)
  }

  // Format date display
  const formatDateDisplay = () => {
    if (viewType === 'day') {
      return currentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    } else {
      // Week view: show start and end of week
      const startOfWeek = new Date(currentDate)
      const day = startOfWeek.getDay()
      const diff = startOfWeek.getDate() - day
      startOfWeek.setDate(diff)

      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(endOfWeek.getDate() + 6)

      const startMonth = startOfWeek.toLocaleDateString('en-US', { month: 'short' })
      const endMonth = endOfWeek.toLocaleDateString('en-US', { month: 'short' })
      const startDay = startOfWeek.getDate()
      const endDay = endOfWeek.getDate()
      const year = endOfWeek.getFullYear()

      if (startMonth === endMonth) {
        return `${startMonth} ${startDay} - ${endDay}, ${year}`
      } else {
        return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`
      }
    }
  }

  return (
    <div className={cn("flex items-center justify-between p-4 border-b bg-card", className)}>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handlePrevious}
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <h2 className="text-lg font-semibold">
          {formatDateDisplay()}
        </h2>

        <Button
          variant="outline"
          size="icon"
          onClick={handleNext}
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleSync}
          disabled={syncEvents.isPending}
          aria-label="Refresh calendar"
          title="Sync events from Google Calendar"
        >
          <RotateCw className={cn(
            "h-4 w-4",
            syncEvents.isPending && "animate-spin"
          )} />
        </Button>

        <div className="flex border rounded-md">
          <Button
            variant={viewType === 'day' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewTypeChange('day')}
            className="rounded-r-none"
          >
            Day
          </Button>
          <Button
            variant={viewType === 'week' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewTypeChange('week')}
            className="rounded-l-none"
          >
            Week
          </Button>
        </div>
      </div>
    </div>
  )
}
