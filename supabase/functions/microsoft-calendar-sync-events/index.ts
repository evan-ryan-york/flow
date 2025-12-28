import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Microsoft Graph uses ISO 8601 date format
const SYNC_PAST_DAYS = 30;
const SYNC_FUTURE_DAYS = 90;

async function refreshTokenIfNeeded(connectionId: string) {
  const refreshUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/microsoft-calendar-refresh-token`;

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
    // Check for existing sync state (deltaLink)
    const { data: syncState } = await supabaseClient
      .from("calendar_sync_state")
      .select("*")
      .eq("subscription_id", subscription.id)
      .single();

    let url: string;
    let isFullSync = false;

    if (syncState?.sync_token) {
      // Use deltaLink for incremental sync
      url = syncState.sync_token;
    } else {
      // Full sync with date filter
      isFullSync = true;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - SYNC_PAST_DAYS);

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + SYNC_FUTURE_DAYS);

      // Build initial delta URL with date filter
      const baseUrl = `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(subscription.provider_calendar_id)}/events/delta`;
      const params = new URLSearchParams({
        $select: "id,subject,bodyPreview,start,end,isAllDay,location,categories",
      });
      // Note: Microsoft Graph delta doesn't support $filter on first request for some scenarios
      // We'll filter client-side instead
      url = `${baseUrl}?${params.toString()}`;
    }

    let allEvents: any[] = [];
    let deltaLink: string | null = null;

    // Paginate through results
    while (url) {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${connection.access_token}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Microsoft Graph error:", response.status, errorText);

        // Handle 410 Gone (invalid delta token) - need full sync
        if (response.status === 410) {
          console.log("Delta token expired, performing full sync");
          // Clear sync token and retry
          await supabaseClient
            .from("calendar_sync_state")
            .delete()
            .eq("subscription_id", subscription.id);

          // Recursive call for full sync
          return syncCalendarEvents(supabaseClient, connection, subscription);
        }

        // Handle 401 - mark connection for reauth
        if (response.status === 401) {
          await supabaseClient
            .from("calendar_connections")
            .update({ requires_reauth: true })
            .eq("id", connection.id);
        }

        return {
          subscriptionId: subscription.id,
          calendarName: subscription.calendar_name,
          success: false,
          error: `Graph API error: ${response.status}`,
        };
      }

      const data = await response.json();
      allEvents = allEvents.concat(data.value || []);

      // Get next page or delta link
      url = data["@odata.nextLink"] || null;
      deltaLink = data["@odata.deltaLink"] || deltaLink;
    }

    console.log(
      `Fetched ${allEvents.length} events for calendar ${subscription.calendar_name}`
    );

    // Filter events by date range if this is a full sync
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - SYNC_PAST_DAYS);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + SYNC_FUTURE_DAYS);

    let insertedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    // Process events
    for (const event of allEvents) {
      // Handle deleted events (have @removed property)
      if (event["@removed"]) {
        const { error: deleteError } = await supabaseClient
          .from("calendar_events")
          .delete()
          .eq("subscription_id", subscription.id)
          .eq("provider_event_id", event.id);

        if (!deleteError) deletedCount++;
        continue;
      }

      // Skip events without required fields
      if (!event.start || !event.end) {
        console.warn(`Event ${event.id} missing start or end time, skipping`);
        continue;
      }

      // Parse start and end times
      // Microsoft returns dateTime without Z suffix for non-UTC times
      let startTime = event.start.dateTime;
      let endTime = event.end.dateTime;

      // Handle all-day events (date only, no time)
      if (event.isAllDay) {
        // All-day events have dateTime at midnight UTC
        startTime = event.start.dateTime;
        endTime = event.end.dateTime;
      }

      // Add Z if not present (Microsoft returns times in the calendar's timezone)
      if (startTime && !startTime.endsWith("Z")) {
        startTime = startTime + "Z";
      }
      if (endTime && !endTime.endsWith("Z")) {
        endTime = endTime + "Z";
      }

      // Filter by date range for full sync
      if (isFullSync) {
        const eventStart = new Date(startTime);
        if (eventStart < startDate || eventStart > endDate) {
          continue; // Skip events outside our sync range
        }
      }

      const eventData = {
        connection_id: connection.id,
        subscription_id: subscription.id,
        provider: "microsoft",
        provider_event_id: event.id,
        provider_calendar_id: subscription.provider_calendar_id,
        user_id: connection.user_id,
        title: event.subject || "(No title)",
        description: event.bodyPreview || null,
        start_time: startTime,
        end_time: endTime,
        is_all_day: event.isAllDay || false,
        location: event.location?.displayName || null,
        color: null, // Microsoft events don't have individual colors
        etag: event["@odata.etag"] || null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Check if event already exists for THIS subscription
      const { data: existingEvent } = await supabaseClient
        .from("calendar_events")
        .select("id")
        .eq("subscription_id", subscription.id)
        .eq("provider_event_id", event.id)
        .single();

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

    // Save delta link for next sync
    if (deltaLink) {
      await supabaseClient.from("calendar_sync_state").upsert(
        {
          subscription_id: subscription.id,
          sync_token: deltaLink,
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "subscription_id",
        }
      );
    }

    console.log(
      `Calendar ${subscription.calendar_name}: ${insertedCount} inserted, ${updatedCount} updated, ${deletedCount} deleted`
    );

    return {
      subscriptionId: subscription.id,
      calendarName: subscription.calendar_name,
      success: true,
      inserted: insertedCount,
      updated: updatedCount,
      deleted: deletedCount,
    };
  } catch (error) {
    console.error(`Error syncing subscription ${subscription.id}:`, error);
    return {
      subscriptionId: subscription.id,
      calendarName: subscription.calendar_name,
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

    // Get Microsoft connections to sync
    let connectionsQuery = supabaseClient
      .from("calendar_connections")
      .select("*")
      .eq("provider", "microsoft")
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
          message: "No Microsoft connections to sync",
          results: [],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `Syncing events for ${connections.length} Microsoft connections`
    );

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

    return new Response(
      JSON.stringify({
        message: `Synced ${successCount} Microsoft calendar(s), ${failureCount} failure(s)`,
        summary: {
          inserted: totalInserted,
          updated: totalUpdated,
          deleted: totalDeleted,
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
