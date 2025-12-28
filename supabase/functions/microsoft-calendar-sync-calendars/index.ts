import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function refreshTokenIfNeeded(supabaseClient: any, connectionId: string) {
  // Call the refresh token function to ensure token is valid
  const refreshUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/microsoft-calendar-refresh-token`;

  try {
    console.log("Attempting to refresh token for connection:", connectionId);
    const response = await fetch(refreshUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ connectionId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Token refresh failed:", response.status, errorText);
    } else {
      console.log("Token refreshed successfully");
    }
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
    // Get the authorization token from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get authenticated user - pass the JWT token explicitly
    const token = authHeader.replace("Bearer ", "");
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
      .from("calendar_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("provider", "microsoft")
      .single();

    if (connectionError || !connection) {
      return new Response(
        JSON.stringify({ error: "Microsoft connection not found or access denied" }),
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
      .from("calendar_connections")
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

    // Fetch calendar list from Microsoft Graph
    const calendarListResponse = await fetch(
      "https://graph.microsoft.com/v1.0/me/calendars",
      {
        headers: {
          Authorization: `Bearer ${updatedConnection.access_token}`,
        },
      }
    );

    if (!calendarListResponse.ok) {
      const errorData = await calendarListResponse.text();
      console.error("Microsoft Graph API error:", errorData);

      // Mark for reauth if 401
      if (calendarListResponse.status === 401) {
        await supabaseClient
          .from("calendar_connections")
          .update({ requires_reauth: true })
          .eq("id", connectionId);
      }

      return new Response(
        JSON.stringify({
          error: "Failed to fetch calendars from Microsoft",
          details: errorData,
        }),
        {
          status: calendarListResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const calendarListData = await calendarListResponse.json();
    const calendars = calendarListData.value || [];

    console.log(`Found ${calendars.length} calendars from Microsoft`);
    console.log(
      "Calendar IDs:",
      calendars.map((c: any) => c.id)
    );

    // Get existing subscriptions for this connection
    const { data: existingSubscriptions } = await supabaseClient
      .from("calendar_subscriptions")
      .select("*")
      .eq("connection_id", connectionId);

    const existingMap = new Map(
      (existingSubscriptions || []).map((sub: any) => [
        sub.provider_calendar_id,
        sub,
      ])
    );

    const microsoftCalendarIds = new Set(calendars.map((cal: any) => cal.id));

    // Upsert calendars
    const upsertPromises = calendars.map(async (calendar: any) => {
      const existing = existingMap.get(calendar.id);

      const subscriptionData = {
        user_id: user.id, // Required for RLS policy
        connection_id: connectionId,
        provider_calendar_id: calendar.id,
        calendar_name: calendar.name || "(No name)",
        calendar_color: calendar.hexColor || calendar.color || null,
        background_color: calendar.hexColor || "#0078d4", // Default Microsoft blue
        is_visible: existing ? existing.is_visible : true, // Preserve user preference
        sync_enabled: existing ? existing.sync_enabled : true,
        updated_at: new Date().toISOString(),
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

    const upsertResults = await Promise.all(upsertPromises);
    console.log(
      "Upsert results:",
      upsertResults.map((r) => ({ error: r.error, count: r.data?.length }))
    );

    // Delete subscriptions for calendars that no longer exist in Microsoft
    const subscriptionsToDelete = (existingSubscriptions || []).filter(
      (sub: any) => !microsoftCalendarIds.has(sub.provider_calendar_id)
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
