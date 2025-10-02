"use client"

import * as React from "react"
import {
  useGoogleCalendarConnections,
  useConnectGoogleCalendar,
  useDisconnectGoogleCalendar,
  useUpdateConnectionLabel,
  useCalendarSubscriptions,
  useSyncCalendarList
} from "@perfect-task-app/data"
import { Button } from "@perfect-task-app/ui/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@perfect-task-app/ui/components/ui/card"
import { Input } from "@perfect-task-app/ui/components/ui/input"
import { Label } from "@perfect-task-app/ui/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@perfect-task-app/ui/components/ui/dialog"
import { CalendarPicker } from "@perfect-task-app/ui/components/Calendar"
import { Plus, Trash2, Edit2, RefreshCw, Check, X } from "@perfect-task-app/ui/components/Calendar/icons"

export default function CalendarConnectionsPage() {
  const { data: connections, isLoading: connectionsLoading, error: connectionsError } = useGoogleCalendarConnections()
  const { data: subscriptions } = useCalendarSubscriptions()
  const connectCalendar = useConnectGoogleCalendar()
  const disconnectCalendar = useDisconnectGoogleCalendar()
  const updateLabel = useUpdateConnectionLabel()
  const syncCalendarList = useSyncCalendarList()

  // Debug logging
  React.useEffect(() => {
    console.log('📊 Connections:', connections)
    console.log('📊 Loading:', connectionsLoading)
    console.log('📊 Error:', connectionsError)
    console.log('📊 Subscriptions:', subscriptions)
  }, [connections, connectionsLoading, connectionsError, subscriptions])

  const [connectDialogOpen, setConnectDialogOpen] = React.useState(false)
  const [newLabel, setNewLabel] = React.useState("")
  const [editingConnectionId, setEditingConnectionId] = React.useState<string | null>(null)
  const [editLabel, setEditLabel] = React.useState("")

  const handleConnect = () => {
    connectCalendar.mutate(newLabel || undefined, {
      onError: (error) => {
        alert(error.message || 'Failed to connect calendar')
      }
    })
    setConnectDialogOpen(false)
    setNewLabel("")
  }

  const handleDisconnect = (connectionId: string) => {
    if (confirm('Are you sure you want to disconnect this calendar account? All associated calendars and events will be removed.')) {
      disconnectCalendar.mutate(connectionId)
    }
  }

  const handleStartEdit = (connectionId: string, currentLabel: string) => {
    setEditingConnectionId(connectionId)
    setEditLabel(currentLabel)
  }

  const handleSaveEdit = (connectionId: string) => {
    if (editLabel.trim()) {
      updateLabel.mutate({
        connectionId,
        label: editLabel.trim()
      })
    }
    setEditingConnectionId(null)
    setEditLabel("")
  }

  const handleCancelEdit = () => {
    setEditingConnectionId(null)
    setEditLabel("")
  }

  const handleSyncCalendars = (connectionId: string) => {
    syncCalendarList.mutate(connectionId, {
      onSuccess: () => {
        console.log('✅ Sync successful, invalidating queries...')
        alert('Calendar list synced successfully!')
      },
      onError: (error) => {
        console.error('❌ Sync failed:', error)
        alert(`Failed to sync: ${error.message}`)
      }
    })
  }

  // Get calendar count for a connection
  const getCalendarCount = (connectionId: string) => {
    return subscriptions?.filter(sub => sub.connection_id === connectionId).length || 0
  }

  if (connectionsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Calendar Connections</h1>
        <p className="text-muted-foreground">
          Manage your connected Google Calendar accounts
        </p>
      </div>

      <div className="space-y-6">
        {/* Connect New Account Button */}
        <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Connect New Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect Google Calendar</DialogTitle>
              <DialogDescription>
                Give this account a label to help you identify it (e.g., "Work", "Personal")
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="label">Account Label (Optional)</Label>
                <Input
                  id="label"
                  placeholder="e.g., Work, Personal"
                  value={newLabel}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewLabel(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') {
                      handleConnect()
                    }
                  }}
                />
              </div>
              <Button onClick={handleConnect} className="w-full">
                Continue to Google
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Connection Cards */}
        {connections && connections.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                No calendar accounts connected. Click "Connect New Account" to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {connections?.map((connection) => (
              <Card key={connection.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {editingConnectionId === connection.id ? (
                        <div className="flex items-center gap-2 mb-2">
                          <Input
                            value={editLabel}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditLabel(e.target.value)}
                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                              if (e.key === 'Enter') {
                                handleSaveEdit(connection.id)
                              } else if (e.key === 'Escape') {
                                handleCancelEdit()
                              }
                            }}
                            className="max-w-xs"
                            autoFocus
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleSaveEdit(connection.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle>{connection.label}</CardTitle>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleStartEdit(connection.id, connection.label)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      <CardDescription>{connection.email}</CardDescription>
                      <div className="mt-2 text-sm text-muted-foreground">
                        {getCalendarCount(connection.id)} calendar{getCalendarCount(connection.id) !== 1 ? 's' : ''}
                      </div>
                      {connection.requires_reauth && (
                        <div className="mt-2 text-sm text-destructive">
                          ⚠️ Re-authentication required
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleSyncCalendars(connection.id)}
                        disabled={syncCalendarList.isPending}
                        title="Sync calendar list"
                      >
                        <RefreshCw className={`h-4 w-4 ${syncCalendarList.isPending ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => handleDisconnect(connection.id)}
                        disabled={disconnectCalendar.isPending}
                        title="Disconnect account"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Calendar list for this connection */}
                  <CalendarPicker connectionId={connection.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
