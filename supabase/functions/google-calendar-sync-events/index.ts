import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function refreshTokenIfNeeded(connectionId: string) {
  const refreshUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-refresh-token`;

  try {
    await fetch(refreshUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ connectionId }),
    });
  } catch (error) {
    console.error("Error refreshing token:", error);
  }
}

async function syncCalendarEvents(
  supabaseClient: any,
  connection: any,
  subscription: any
) {
  try {
    // Check for existing sync state
    const { data: syncState } = await supabaseClient
      .from("calendar_sync_state")
      .select("*")
      .eq("subscription_id", subscription.id)
      .single();

    // Build request params
    const params: any = {
      singleEvents: "true", // Expand recurring events
      orderBy: "startTime",
    };

    // Force full sync if last sync was more than 24 hours ago
    let isFullSync = false;
    if (syncState?.sync_token) {
      const lastSyncAge = syncState.last_sync_at
        ? Date.now() - new Date(syncState.last_sync_at).getTime()
        : Infinity;
      const twentyFourHours = 24 * 60 * 60 * 1000;

      if (lastSyncAge > twentyFourHours) {
        console.log(
          `Forcing full sync for subscription ${subscription.id} — last sync was ${Math.round(lastSyncAge / 3600000)}h ago`
        );
        isFullSync = true;
      } else {
        params.syncToken = syncState.sync_token;
      }
    } else {
      isFullSync = true;
    }

    if (isFullSync) {
      // Full sync - get events from 30 days ago to 90 days in future
      const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      params.timeMin = timeMin.toISOString();
      params.timeMax = timeMax.toISOString();
    }

    // Fetch events from Google with pagination
    const allEvents: any[] = [];
    let nextSyncToken: string | undefined;
    let pageToken: string | undefined;
    let paginationComplete = true;
    const MAX_PAGES = 20;

    for (let page = 0; page < MAX_PAGES; page++) {
      const url = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          subscription.provider_calendar_id
        )}/events`
      );

      const pageParams = { ...params };
      if (pageToken) {
        pageParams.pageToken = pageToken;
      }

      Object.entries(pageParams).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${connection.access_token}` },
      });

      if (!response.ok) {
        // Sync token expired - do full sync
        if (response.status === 410) {
          console.log(
            `Sync token expired for subscription ${subscription.id}, doing full sync`
          );
          await supabaseClient
            .from("calendar_sync_state")
            .delete()
            .eq("subscription_id", subscription.id);

          // Retry with full sync
          return syncCalendarEvents(supabaseClient, connection, subscription);
        }

        const errorData = await response.text();
        console.error(
          `Google API error for subscription ${subscription.id} (page ${page + 1}):`,
          errorData
        );
        return {
          subscriptionId: subscription.id,
          success: false,
          error: `HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      const pageEvents = data.items || [];
      allEvents.push(...pageEvents);

      if (data.nextSyncToken) {
        nextSyncToken = data.nextSyncToken;
      }

      if (data.nextPageToken) {
        pageToken = data.nextPageToken;
        console.log(
          `Page ${page + 1}: fetched ${pageEvents.length} events, continuing to next page`
        );
      } else {
        if (page > 0) {
          console.log(
            `Page ${page + 1}: fetched ${pageEvents.length} events, pagination complete (${allEvents.length} total)`
          );
        }
        break;
      }

      // If we're about to exceed the page cap, mark pagination incomplete
      if (page === MAX_PAGES - 1) {
        console.warn(
          `Hit ${MAX_PAGES}-page cap for subscription ${subscription.id} (${allEvents.length} events fetched)`
        );
        paginationComplete = false;
      }
    }

    const events = allEvents;

    console.log(`📊 Google API returned ${events.length} events for subscription ${subscription.id} (${subscription.calendar_name})`);
    console.log(`   Connection: ${connection.label || connection.account_email}`);
    console.log(`   Calendar ID: ${subscription.provider_calendar_id}`);
    console.log(`   Query params:`, JSON.stringify(params));

    // Log today's events specifically
    const today = new Date().toISOString().split('T')[0];
    const todayEvents = events.filter((e: any) => {
      const start = e.start?.dateTime || e.start?.date;
      return start && start.startsWith(today);
    });

    if (todayEvents.length > 0) {
      console.log(`   📅 Events for ${today}:`, todayEvents.map((e: any) => ({
        id: e.id,
        summary: e.summary,
        start: e.start?.dateTime || e.start?.date
      })));
    } else {
      console.log(`   ⚠️ No events found for ${today}`);
    }

    if (events.length > 0) {
      console.log(`   Sample event IDs:`, events.slice(0, 5).map((e: any) => e.id));
    }

    let insertedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    // Process events
    for (const event of events) {
      if (event.status === "cancelled") {
        // Delete from our DB for THIS subscription
        const { error: deleteError } = await supabaseClient
          .from("calendar_events")
          .delete()
          .eq("subscription_id", subscription.id)
          .eq("provider_event_id", event.id);

        if (!deleteError) deletedCount++;
        continue;
      }

      // Determine if all-day event
      const isAllDay = !!event.start?.date;

      // Parse start and end times
      const startTime = event.start?.dateTime || event.start?.date;
      const endTime = event.end?.dateTime || event.end?.date;

      if (!startTime || !endTime) {
        console.warn(`Event ${event.id} missing start or end time, skipping`);
        continue;
      }

      // Check if event already exists for THIS subscription
      // Note: Same Google event can appear in multiple calendars, so we key by subscription_id
      const { data: existingEvent } = await supabaseClient
        .from("calendar_events")
        .select("id")
        .eq("subscription_id", subscription.id)
        .eq("provider_event_id", event.id)
        .single();

      const eventData = {
        connection_id: connection.id,
        subscription_id: subscription.id,
        provider: "google",
        provider_event_id: event.id,
        provider_calendar_id: subscription.provider_calendar_id,
        user_id: connection.user_id,
        title: event.summary || "(No title)",
        description: event.description || null,
        start_time: startTime,
        end_time: endTime,
        is_all_day: isAllDay,
        location: event.location || null,
        color: event.colorId || subscription.background_color,
        etag: event.etag,
        last_synced_at: new Date().toISOString(),
      };

      if (existingEvent) {
        // Update existing event
        const { error: updateError } = await supabaseClient
          .from("calendar_events")
          .update(eventData)
          .eq("id", existingEvent.id);

        if (!updateError) updatedCount++;
      } else {
        // Insert new event
        const { error: insertError } = await supabaseClient
          .from("calendar_events")
          .insert(eventData);

        if (!insertError) insertedCount++;
      }
    }

    // Reconcile: remove local events that Google no longer returns (full sync only)
    let reconciledCount = 0;
    if (
      isFullSync &&
      events.length > 0 &&
      paginationComplete
    ) {
      // Collect all non-cancelled provider_event_ids from Google's response
      const googleEventIds = new Set(
        events
          .filter((e: any) => e.status !== "cancelled")
          .map((e: any) => e.id)
      );

      // Query local events for this subscription within the same time window
      const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      const { data: localEvents, error: localError } = await supabaseClient
        .from("calendar_events")
        .select("id, provider_event_id")
        .eq("subscription_id", subscription.id)
        .gte("start_time", timeMin)
        .lte("start_time", timeMax);

      if (!localError && localEvents) {
        const staleEvents = localEvents.filter(
          (le: any) => !googleEventIds.has(le.provider_event_id)
        );

        // Safety threshold: skip if deleting >80% of events and there are >10 events
        if (
          staleEvents.length > 0 &&
          localEvents.length > 10 &&
          staleEvents.length / localEvents.length > 0.8
        ) {
          console.warn(
            `Reconciliation skipped for subscription ${subscription.id}: would remove ${staleEvents.length}/${localEvents.length} events (>80%). Possible API issue.`
          );
        } else if (staleEvents.length > 0) {
          console.log(
            `Reconciling ${staleEvents.length} stale events for subscription ${subscription.id}`
          );

          // Batch deletes in groups of 100
          const staleIds = staleEvents.map((e: any) => e.id);
          for (let i = 0; i < staleIds.length; i += 100) {
            const batch = staleIds.slice(i, i + 100);
            const { error: deleteError } = await supabaseClient
              .from("calendar_events")
              .delete()
              .in("id", batch);

            if (!deleteError) {
              reconciledCount += batch.length;
            } else {
              console.error(
                `Error deleting stale events batch for subscription ${subscription.id}:`,
                deleteError
              );
            }
          }
        }
      }
    }

    // Store next sync token
    if (nextSyncToken) {
      await supabaseClient.from("calendar_sync_state").upsert({
        subscription_id: subscription.id,
        sync_token: nextSyncToken,
        last_sync_at: new Date().toISOString(),
      });
    }

    return {
      subscriptionId: subscription.id,
      calendarName: subscription.calendar_name,
      success: true,
      inserted: insertedCount,
      updated: updatedCount,
      deleted: deletedCount,
      reconciled: reconciledCount,
    };
  } catch (error) {
    console.error(
      `Error syncing subscription ${subscription.id}:`,
      error
    );
    return {
      subscriptionId: subscription.id,
      success: false,
      error: String(error),
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Check if this is a service role request (cron job)
    const authHeader = req.headers.get("Authorization");
    const isServiceRole = authHeader?.includes(
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      isServiceRole
        ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        : Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      isServiceRole
        ? {}
        : {
            global: {
              headers: { Authorization: authHeader! },
            },
          }
    );

    // Parse request body for specific connection ID (optional)
    let connectionId: string | undefined;
    let userId: string | undefined;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        connectionId = body.connectionId;
      } catch {
        // No body or invalid JSON
      }
    }

    // Get user if authenticated (not service role)
    if (!isServiceRole) {
      const token = authHeader?.replace("Bearer ", "");
      const {
        data: { user },
        error: userError,
      } = await supabaseClient.auth.getUser(token);

      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    // Get Google connections to sync
    let connectionsQuery = supabaseClient
      .from("calendar_connections")
      .select("*")
      .eq("provider", "google")
      .eq("requires_reauth", false);

    if (connectionId) {
      connectionsQuery = connectionsQuery.eq("id", connectionId);
    }

    if (userId) {
      connectionsQuery = connectionsQuery.eq("user_id", userId);
    }

    const { data: connections, error: connectionsError } =
      await connectionsQuery;

    if (connectionsError) {
      console.error("Error querying connections:", connectionsError);
      return new Response(
        JSON.stringify({ error: "Failed to query connections" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!connections || connections.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No connections to sync",
          results: [],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const allResults: any[] = [];

    // Sync each connection
    for (const connection of connections) {
      // Refresh token if needed
      await refreshTokenIfNeeded(connection.id);

      // Get updated connection with fresh token
      const { data: updatedConnection } = await supabaseClient
        .from("calendar_connections")
        .select("*")
        .eq("id", connection.id)
        .single();

      if (!updatedConnection) continue;

      // Get enabled AND visible subscriptions only to reduce sync time
      const { data: subscriptions } = await supabaseClient
        .from("calendar_subscriptions")
        .select("*")
        .eq("connection_id", connection.id)
        .eq("sync_enabled", true)
        .eq("is_visible", true);

      if (!subscriptions || subscriptions.length === 0) {
        continue;
      }

      // Sync each subscription (can be done in parallel)
      const syncPromises = subscriptions.map((subscription) =>
        syncCalendarEvents(supabaseClient, updatedConnection, subscription)
      );

      const results = await Promise.all(syncPromises);
      allResults.push(...results);
    }

    const successCount = allResults.filter((r) => r.success).length;
    const failureCount = allResults.filter((r) => !r.success).length;
    const totalInserted = allResults.reduce(
      (sum, r) => sum + (r.inserted || 0),
      0
    );
    const totalUpdated = allResults.reduce(
      (sum, r) => sum + (r.updated || 0),
      0
    );
    const totalDeleted = allResults.reduce(
      (sum, r) => sum + (r.deleted || 0),
      0
    );
    const totalReconciled = allResults.reduce(
      (sum, r) => sum + (r.reconciled || 0),
      0
    );

    return new Response(
      JSON.stringify({
        message: `Synced ${successCount} calendar(s), ${failureCount} failure(s)`,
        summary: {
          inserted: totalInserted,
          updated: totalUpdated,
          deleted: totalDeleted,
          reconciled: totalReconciled,
        },
        results: allResults,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
