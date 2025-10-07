import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RefreshTokenResult {
  connectionId: string;
  success: boolean;
  error?: string;
}

async function refreshConnection(
  supabaseClient: any,
  connection: any
): Promise<RefreshTokenResult> {
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: connection.refresh_token,
        client_id: clientId!,
        client_secret: clientSecret!,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(
        `Failed to refresh token for connection ${connection.id}:`,
        errorData
      );

      // Check if refresh token is invalid/revoked
      if (response.status === 400) {
        // Mark connection as requiring re-auth
        await supabaseClient
          .from("google_calendar_connections")
          .update({ requires_reauth: true })
          .eq("id", connection.id);

        return {
          connectionId: connection.id,
          success: false,
          error: "Refresh token invalid - requires re-authorization",
        };
      }

      return {
        connectionId: connection.id,
        success: false,
        error: `HTTP ${response.status}`,
      };
    }

    const tokens = await response.json();

    // Calculate new expiry time
    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString();

    // Update connection with new tokens
    const updateData: any = {
      access_token: tokens.access_token,
      expires_at: expiresAt,
      requires_reauth: false,
    };

    // Google may rotate refresh tokens
    if (tokens.refresh_token) {
      updateData.refresh_token = tokens.refresh_token;
    }

    const { error: updateError } = await supabaseClient
      .from("google_calendar_connections")
      .update(updateData)
      .eq("id", connection.id);

    if (updateError) {
      console.error(
        `Error updating connection ${connection.id}:`,
        updateError
      );
      return {
        connectionId: connection.id,
        success: false,
        error: "Database update failed",
      };
    }

    return { connectionId: connection.id, success: true };
  } catch (error) {
    console.error(`Error refreshing connection ${connection.id}:`, error);
    return {
      connectionId: connection.id,
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
    // Create Supabase client with service role for cron jobs, or with user auth for manual calls
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
    if (req.method === "POST") {
      try {
        const body = await req.json();
        connectionId = body.connectionId;
      } catch {
        // No body or invalid JSON - that's okay, we'll refresh all
      }
    }

    // Get user if authenticated (not service role)
    let userId: string | undefined;
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

    // Query connections that need token refresh (expires within 5 minutes)
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    let query = supabaseClient
      .from("google_calendar_connections")
      .select("*")
      .lt("expires_at", fiveMinutesFromNow.toISOString());

    // If specific connection requested, filter to that
    if (connectionId) {
      query = query.eq("id", connectionId);
    }

    // If user-authenticated (not service role), only their connections
    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data: connections, error: queryError } = await query;

    if (queryError) {
      console.error("Error querying connections:", queryError);
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
          message: "No connections need token refresh",
          refreshed: [],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Refresh all expired connections
    const results: RefreshTokenResult[] = [];

    for (const connection of connections) {
      const result = await refreshConnection(supabaseClient, connection);
      results.push(result);

      // Add exponential backoff if we hit rate limits
      if (result.error?.includes("429")) {
        console.log("Rate limit hit, adding delay...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({
        message: `Refreshed ${successCount} connection(s), ${failureCount} failure(s)`,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
