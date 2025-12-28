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

    // Use incremental sync if we have a sync token
    if (syncState?.sync_token) {
      params.syncToken = syncState.sync_token;
    } else {
      // Full sync - get events from 30 days ago to 90 days in future
      const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      params.timeMin = timeMin.toISOString();
      params.timeMax = timeMax.toISOString();
    }

    // Fetch events from Google
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        subscription.provider_calendar_id
      )}/events`
    );

    Object.entries(params).forEach(([key, value]) => {
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
        `Google API error for subscription ${subscription.id}:`,
        errorData
      );
      return {
        subscriptionId: subscription.id,
        success: false,
        error: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    const events = data.items || [];

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

    // Store next sync token
    if (data.nextSyncToken) {
      await supabaseClient.from("calendar_sync_state").upsert({
        subscription_id: subscription.id,
        sync_token: data.nextSyncToken,
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

    return new Response(
      JSON.stringify({
        message: `Synced ${successCount} calendar(s), ${failureCount} failure(s)`,
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
