import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function refreshTokenIfNeeded(supabaseClient: any, connectionId: string) {
  // Call the refresh token function to ensure token is valid
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
    // Continue anyway - the token might still be valid
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { connectionId } = await req.json();

    if (!connectionId) {
      return new Response(
        JSON.stringify({ error: "connectionId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the connection (RLS will ensure user owns it)
    const { data: connection, error: connectionError } = await supabaseClient
      .from("google_calendar_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (connectionError || !connection) {
      return new Response(
        JSON.stringify({ error: "Connection not found or access denied" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Refresh token if needed
    await refreshTokenIfNeeded(supabaseClient, connectionId);

    // Refetch connection to get updated token
    const { data: updatedConnection } = await supabaseClient
      .from("google_calendar_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (!updatedConnection) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch updated connection" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch calendar list from Google
    const calendarListResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      {
        headers: {
          Authorization: `Bearer ${updatedConnection.access_token}`,
        },
      }
    );

    if (!calendarListResponse.ok) {
      const errorData = await calendarListResponse.text();
      console.error("Google Calendar API error:", errorData);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch calendars from Google",
          details: errorData,
        }),
        {
          status: calendarListResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const calendarListData = await calendarListResponse.json();
    const calendars = calendarListData.items || [];

    // Get existing subscriptions for this connection
    const { data: existingSubscriptions } = await supabaseClient
      .from("calendar_subscriptions")
      .select("*")
      .eq("connection_id", connectionId);

    const existingMap = new Map(
      (existingSubscriptions || []).map((sub: any) => [
        sub.google_calendar_id,
        sub,
      ])
    );

    const googleCalendarIds = new Set(calendars.map((cal: any) => cal.id));

    // Upsert calendars
    const upsertPromises = calendars.map(async (calendar: any) => {
      const existing = existingMap.get(calendar.id);

      const subscriptionData = {
        connection_id: connectionId,
        google_calendar_id: calendar.id,
        calendar_name: calendar.summary || "(No name)",
        calendar_color: calendar.foregroundColor || "#000000",
        background_color: calendar.backgroundColor || "#4285f4",
        is_visible: existing ? existing.is_visible : true, // Preserve user preference
        sync_enabled: existing ? existing.sync_enabled : true,
      };

      if (existing) {
        // Update existing
        return supabaseClient
          .from("calendar_subscriptions")
          .update(subscriptionData)
          .eq("id", existing.id);
      } else {
        // Insert new
        return supabaseClient
          .from("calendar_subscriptions")
          .insert(subscriptionData);
      }
    });

    await Promise.all(upsertPromises);

    // Delete subscriptions for calendars that no longer exist in Google
    const subscriptionsToDelete = (existingSubscriptions || []).filter(
      (sub: any) => !googleCalendarIds.has(sub.google_calendar_id)
    );

    if (subscriptionsToDelete.length > 0) {
      const deleteIds = subscriptionsToDelete.map((sub: any) => sub.id);
      await supabaseClient
        .from("calendar_subscriptions")
        .delete()
        .in("id", deleteIds);
    }

    // Fetch updated subscriptions to return
    const { data: updatedSubscriptions } = await supabaseClient
      .from("calendar_subscriptions")
      .select("*")
      .eq("connection_id", connectionId)
      .order("calendar_name");

    return new Response(
      JSON.stringify({
        message: `Synced ${calendars.length} calendars`,
        calendars: updatedSubscriptions,
        deleted: subscriptionsToDelete.length,
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
