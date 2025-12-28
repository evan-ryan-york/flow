"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  useCalendarConnections,
  useConnectGoogleCalendar,
  useConnectMicrosoftCalendar,
  useDisconnectGoogleCalendar,
  useUpdateConnectionLabel,
  useCalendarSubscriptions,
  useSyncCalendarList
} from "@flow-app/data"
import type { CalendarProvider } from "@flow-app/models"
import { Button } from "@flow-app/ui/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@flow-app/ui/components/ui/card"
import { Input } from "@flow-app/ui/components/ui/input"
import { Label } from "@flow-app/ui/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@flow-app/ui/components/ui/dialog"
import { CalendarPicker } from "@flow-app/ui/components/Calendar"
import { Plus, Trash2, Edit2, RefreshCw, Check, X } from "@flow-app/ui/components/Calendar/icons"

// Provider icons
const GoogleIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

const MicrosoftIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24">
    <path fill="#F25022" d="M1 1h10v10H1z"/>
    <path fill="#7FBA00" d="M13 1h10v10H13z"/>
    <path fill="#00A4EF" d="M1 13h10v10H1z"/>
    <path fill="#FFB900" d="M13 13h10v10H13z"/>
  </svg>
)

export default function CalendarConnectionsPage() {
  const router = useRouter()
  const { data: connections, isLoading: connectionsLoading, error: connectionsError } = useCalendarConnections()
  const { data: subscriptions } = useCalendarSubscriptions()
  const connectGoogleCalendar = useConnectGoogleCalendar()
  const connectMicrosoftCalendar = useConnectMicrosoftCalendar()
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

  const [providerDialogOpen, setProviderDialogOpen] = React.useState(false)
  const [connectDialogOpen, setConnectDialogOpen] = React.useState(false)
  const [selectedProvider, setSelectedProvider] = React.useState<CalendarProvider | null>(null)
  const [newLabel, setNewLabel] = React.useState("")
  const [editingConnectionId, setEditingConnectionId] = React.useState<string | null>(null)
  const [editLabel, setEditLabel] = React.useState("")

  const handleProviderSelect = (provider: CalendarProvider) => {
    setSelectedProvider(provider)
    setProviderDialogOpen(false)
    setConnectDialogOpen(true)
  }

  const handleConnect = () => {
    if (selectedProvider === 'microsoft') {
      connectMicrosoftCalendar.mutate(newLabel || undefined, {
        onSuccess: () => {
          setConnectDialogOpen(false)
          setNewLabel("")
          setSelectedProvider(null)
        },
        onError: (error) => {
          alert(error.message || 'Failed to connect Microsoft calendar')
        }
      })
    } else {
      connectGoogleCalendar.mutate(newLabel || undefined, {
        onError: (error) => {
          alert(error.message || 'Failed to connect Google calendar')
        }
      })
    }
    setConnectDialogOpen(false)
    setNewLabel("")
    setSelectedProvider(null)
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

  const handleSyncCalendars = (connectionId: string, provider: CalendarProvider) => {
    syncCalendarList.mutate({ connectionId, provider }, {
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
        <Button
          variant="ghost"
          onClick={() => router.push('/app')}
          className="mb-4 -ml-2"
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to App
        </Button>
        <h1 className="text-3xl font-bold mb-2">Calendar Connections</h1>
        <p className="text-muted-foreground">
          Manage your connected calendar accounts
        </p>
      </div>

      <div className="space-y-6">
        {/* Provider Selection Dialog */}
        <Dialog open={providerDialogOpen} onOpenChange={setProviderDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Connect New Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect Calendar</DialogTitle>
              <DialogDescription>
                Choose your calendar provider
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2"
                onClick={() => handleProviderSelect('google')}
              >
                <GoogleIcon />
                <span>Google Calendar</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2"
                onClick={() => handleProviderSelect('microsoft')}
              >
                <MicrosoftIcon />
                <span>Microsoft 365</span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Account Label Dialog */}
        <Dialog open={connectDialogOpen} onOpenChange={(open) => {
          setConnectDialogOpen(open)
          if (!open) {
            setSelectedProvider(null)
            setNewLabel("")
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Connect {selectedProvider === 'microsoft' ? 'Microsoft 365' : 'Google Calendar'}
              </DialogTitle>
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
              <Button
                onClick={handleConnect}
                className="w-full"
                disabled={connectGoogleCalendar.isPending || connectMicrosoftCalendar.isPending}
              >
                {(connectGoogleCalendar.isPending || connectMicrosoftCalendar.isPending)
                  ? 'Connecting...'
                  : `Continue to ${selectedProvider === 'microsoft' ? 'Microsoft' : 'Google'}`
                }
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
                          {connection.provider === 'microsoft' ? (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded flex items-center gap-1">
                              <MicrosoftIcon />
                              Microsoft
                            </span>
                          ) : (
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded flex items-center gap-1">
                              <GoogleIcon />
                              Google
                            </span>
                          )}
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
                      <CardDescription>{connection.account_email}</CardDescription>
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
                        onClick={() => handleSyncCalendars(connection.id, connection.provider)}
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
