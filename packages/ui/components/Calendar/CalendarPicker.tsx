"use client"

import * as React from "react"
import { useGoogleCalendarConnections, useCalendarSubscriptions, useToggleCalendarVisibility, useUpdateCalendarColor } from "@perfect-task-app/data"
import { cn } from "../../lib/utils"
import { Checkbox } from "../ui/checkbox"

interface CalendarPickerProps {
  connectionId?: string
  onSelectionChange?: (visibleSubscriptionIds: string[]) => void
  className?: string
}

export function CalendarPicker({ connectionId, onSelectionChange, className }: CalendarPickerProps) {
  const { data: connections, isLoading: connectionsLoading } = useGoogleCalendarConnections()
  const { data: subscriptions, isLoading: subscriptionsLoading } = useCalendarSubscriptions(connectionId)
  const toggleVisibility = useToggleCalendarVisibility()
  const updateColor = useUpdateCalendarColor()
  const [editingColorId, setEditingColorId] = React.useState<string | null>(null)

  // Group subscriptions by connection
  const subscriptionsByConnection = React.useMemo(() => {
    if (!subscriptions) return {}
    return subscriptions.reduce((acc, sub) => {
      if (!acc[sub.connection_id]) {
        acc[sub.connection_id] = []
      }
      acc[sub.connection_id].push(sub)
      return acc
    }, {} as Record<string, typeof subscriptions>)
  }, [subscriptions])

  // Notify parent of visible subscription changes
  React.useEffect(() => {
    if (subscriptions && onSelectionChange) {
      const visibleIds = subscriptions
        .filter(sub => sub.is_visible)
        .map(sub => sub.id)
      onSelectionChange(visibleIds)
    }
  }, [subscriptions, onSelectionChange])

  if (connectionsLoading || subscriptionsLoading) {
    return (
      <div className={cn("space-y-4 p-4", className)}>
        <div className="text-sm text-muted-foreground">Loading calendars...</div>
      </div>
    )
  }

  if (!connections || connections.length === 0) {
    return (
      <div className={cn("space-y-4 p-4", className)}>
        <div className="text-sm text-muted-foreground">
          No calendar accounts connected.
        </div>
        <div className="text-xs text-muted-foreground">
          Connect a Google Calendar account in settings to get started.
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4 p-4", className)}>
      <h3 className="font-semibold text-sm mb-3">Calendars</h3>

      {connections.map(connection => {
        const connectionSubs = subscriptionsByConnection[connection.id] || []

        if (connectionSubs.length === 0) return null

        return (
          <div key={connection.id} className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              {connection.label}
            </div>
            <div className="text-xs text-muted-foreground mb-2">
              {connection.email}
            </div>

            <div className="ml-2 space-y-2">
              {connectionSubs.map(subscription => (
                <div
                  key={subscription.id}
                  className="flex items-center gap-2 hover:bg-accent/50 p-2 rounded-md transition-colors"
                >
                  <Checkbox
                    checked={subscription.is_visible}
                    onCheckedChange={(checked) => {
                      toggleVisibility.mutate({
                        subscriptionId: subscription.id,
                        isVisible: checked === true,
                      })
                    }}
                  />
                  <div className="relative">
                    <input
                      type="color"
                      value={subscription.background_color || subscription.calendar_color || '#4285f4'}
                      onChange={(e) => {
                        updateColor.mutate({
                          subscriptionId: subscription.id,
                          color: e.target.value,
                        })
                      }}
                      className="w-3 h-3 rounded-sm flex-shrink-0 cursor-pointer border-0 p-0"
                      style={{
                        backgroundColor: subscription.background_color || subscription.calendar_color || '#4285f4',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        appearance: 'none',
                      }}
                      title="Click to change calendar color"
                    />
                  </div>
                  <span className="text-sm flex-1 truncate">
                    {subscription.calendar_name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
