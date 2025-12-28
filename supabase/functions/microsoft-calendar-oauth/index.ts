import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MICROSOFT_CLIENT_ID = Deno.env.get("MICROSOFT_CLIENT_ID")!;
const MICROSOFT_CLIENT_SECRET = Deno.env.get("MICROSOFT_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

// Use 'common' for multi-tenant (personal + work accounts)
const TENANT_ID = "common";
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/microsoft-calendar-oauth`;

const SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "Calendars.Read",
  "Calendars.ReadWrite",
  "User.Read",
].join(" ");

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    // Check if this is an OAuth callback (has code and state params)
    const isCallback = code && state;

    // Create Supabase client - different handling for callback vs initiate
    let supabaseClient;
    let user;

    if (isCallback) {
      // Callback flow - no auth header needed, use service role to verify state
      supabaseClient = createClient(
        SUPABASE_URL,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
    } else {
      // Initiate flow - requires authenticated user
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
            details: "Missing Authorization header",
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      supabaseClient = createClient(
        SUPABASE_URL,
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
        data: { user: authUser },
        error: userError,
      } = await supabaseClient.auth.getUser(token);

      if (userError || !authUser) {
        console.error("Auth error:", userError);
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
            details: userError?.message || "No user found",
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      user = authUser;
    }

    // INITIATE OAUTH FLOW
    if (action === "initiate") {
      // Generate secure random state token
      const stateToken = crypto.randomUUID();

      // Store state in temporary table with expiry (5 minutes)
      const { error: stateError } = await supabaseClient
        .from("oauth_state_tokens")
        .insert({
          state_token: stateToken,
          user_id: user.id,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        });

      if (stateError) {
        console.error("Error storing state token:", stateError);
        return new Response(
          JSON.stringify({ error: "Failed to initiate OAuth flow" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Build Microsoft OAuth URL
      const authUrl = new URL(
        `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`
      );
      authUrl.searchParams.set("client_id", MICROSOFT_CLIENT_ID);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
      authUrl.searchParams.set("scope", SCOPES);
      authUrl.searchParams.set("state", stateToken);
      authUrl.searchParams.set("response_mode", "query");
      authUrl.searchParams.set("prompt", "consent"); // Force consent to get refresh token

      return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // HANDLE OAUTH CALLBACK
    if (action === "callback" || req.method === "GET") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      // Handle OAuth denial
      if (error) {
        const errorDescription = url.searchParams.get("error_description");
        console.error("OAuth error from Microsoft:", error, errorDescription);
        return new Response(
          `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Authorization Failed</title>
</head>
<body>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({
          type: 'microsoft-calendar-oauth',
          success: false,
          error: '${error}'
        }, '*');
      }
      window.close();
    } catch (e) {
      console.error('Error closing window:', e);
    }
  </script>
  <p>Authorization failed. You can close this window.</p>
</body>
</html>`,
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "text/html; charset=utf-8",
            },
          }
        );
      }

      if (!code || !state) {
        return new Response(
          JSON.stringify({ error: "Missing code or state parameter" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Verify state parameter
      const { data: stateData, error: stateError } = await supabaseClient
        .from("oauth_state_tokens")
        .select("user_id, expires_at")
        .eq("state_token", state)
        .single();

      if (stateError || !stateData) {
        return new Response(
          `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invalid State</title>
</head>
<body>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({
          type: 'microsoft-calendar-oauth',
          success: false,
          error: 'Invalid state token'
        }, '*');
      }
      window.close();
    } catch (e) {
      console.error('Error closing window:', e);
    }
  </script>
  <p>Invalid state token. You can close this window.</p>
</body>
</html>`,
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "text/html; charset=utf-8",
            },
          }
        );
      }

      // Check if state is expired
      if (new Date(stateData.expires_at) < new Date()) {
        await supabaseClient
          .from("oauth_state_tokens")
          .delete()
          .eq("state_token", state);

        return new Response(
          `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>State Expired</title>
</head>
<body>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({
          type: 'microsoft-calendar-oauth',
          success: false,
          error: 'State token expired'
        }, '*');
      }
      window.close();
    } catch (e) {
      console.error('Error closing window:', e);
    }
  </script>
  <p>State token expired. You can close this window.</p>
</body>
</html>`,
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "text/html; charset=utf-8",
            },
          }
        );
      }

      // Delete used state token
      await supabaseClient
        .from("oauth_state_tokens")
        .delete()
        .eq("state_token", state);

      // Exchange authorization code for tokens
      const tokenResponse = await fetch(
        `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: MICROSOFT_CLIENT_ID,
            client_secret: MICROSOFT_CLIENT_SECRET,
            code,
            redirect_uri: REDIRECT_URI,
            grant_type: "authorization_code",
          }),
        }
      );

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error("Token exchange error:", errorData);
        return new Response(
          `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Token Exchange Failed</title>
</head>
<body>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({
          type: 'microsoft-calendar-oauth',
          success: false,
          error: 'Failed to exchange authorization code'
        }, '*');
      }
      window.close();
    } catch (e) {
      console.error('Error closing window:', e);
    }
  </script>
  <p>Failed to exchange authorization code. You can close this window.</p>
</body>
</html>`,
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "text/html; charset=utf-8",
            },
          }
        );
      }

      const tokens = await tokenResponse.json();
      const { access_token, refresh_token, expires_in } = tokens;

      // Fetch user profile from Microsoft Graph
      const profileResponse = await fetch(
        "https://graph.microsoft.com/v1.0/me",
        {
          headers: { Authorization: `Bearer ${access_token}` },
        }
      );

      if (!profileResponse.ok) {
        console.error("Failed to fetch profile:", await profileResponse.text());
        return new Response(
          `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Profile Fetch Failed</title>
</head>
<body>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({
          type: 'microsoft-calendar-oauth',
          success: false,
          error: 'Failed to fetch user profile'
        }, '*');
      }
      window.close();
    } catch (e) {
      console.error('Error closing window:', e);
    }
  </script>
  <p>Failed to fetch user profile. You can close this window.</p>
</body>
</html>`,
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "text/html; charset=utf-8",
            },
          }
        );
      }

      const profile = await profileResponse.json();
      const email = profile.mail || profile.userPrincipalName;
      const providerId = profile.id; // Microsoft's unique user ID (OID)

      // Calculate token expiry
      const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

      // Check for existing connection with same email
      const { data: existing } = await supabaseClient
        .from("calendar_connections")
        .select("id")
        .eq("user_id", stateData.user_id)
        .eq("provider", "microsoft")
        .eq("account_email", email)
        .single();

      let connectionId: string;

      if (existing) {
        // Update existing connection
        const { error: updateError } = await supabaseClient
          .from("calendar_connections")
          .update({
            access_token,
            refresh_token,
            expires_at: expiresAt,
            requires_reauth: false,
            provider_account_id: providerId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (updateError) {
          console.error("Error updating connection:", updateError);
          throw updateError;
        }
        connectionId = existing.id;
      } else {
        // Create new connection
        const { data: newConnection, error: insertError } = await supabaseClient
          .from("calendar_connections")
          .insert({
            user_id: stateData.user_id,
            provider: "microsoft",
            account_email: email,
            provider_account_id: providerId,
            label: profile.displayName || email,
            access_token,
            refresh_token,
            expires_at: expiresAt,
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("Error inserting connection:", insertError);

          // Check if it's a duplicate key error
          if (insertError.code === "23505") {
            return new Response(
              `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Already Connected</title>
</head>
<body>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({
          type: 'microsoft-calendar-oauth',
          success: false,
          error: 'This email address is already connected to your account.'
        }, '*');
      }
      setTimeout(() => window.close(), 2000);
    } catch (e) {
      console.error('Error closing window:', e);
    }
  </script>
  <p>This email address is already connected to your account.</p>
  <p>This window will close automatically...</p>
</body>
</html>`,
              {
                status: 400,
                headers: {
                  ...corsHeaders,
                  "Content-Type": "text/html; charset=utf-8",
                },
              }
            );
          }

          throw insertError;
        }
        connectionId = newConnection.id;
      }

      // Sync calendar list immediately after creating connection
      // This ensures calendars show up right away without manual sync
      try {
        const calendarListResponse = await fetch(
          "https://graph.microsoft.com/v1.0/me/calendars",
          {
            headers: {
              Authorization: `Bearer ${access_token}`,
            },
          }
        );

        if (calendarListResponse.ok) {
          const calendarListData = await calendarListResponse.json();
          const calendars = calendarListData.value || [];

          console.log(`Found ${calendars.length} Microsoft calendars to sync`);

          // Insert calendar subscriptions
          for (const calendar of calendars) {
            const { error: subError } = await supabaseClient
              .from("calendar_subscriptions")
              .upsert(
                {
                  user_id: stateData.user_id,
                  connection_id: connectionId,
                  provider_calendar_id: calendar.id,
                  calendar_name: calendar.name || "(No name)",
                  calendar_color: calendar.hexColor || null,
                  background_color: calendar.hexColor || "#0078d4",
                  is_visible: true,
                  sync_enabled: true,
                },
                {
                  onConflict: "connection_id,provider_calendar_id",
                }
              );

            if (subError) {
              console.error(`Error upserting calendar ${calendar.id}:`, subError);
            }
          }
          console.log("Microsoft calendar list synced successfully");
        } else {
          console.error("Failed to fetch Microsoft calendar list:", await calendarListResponse.text());
        }
      } catch (syncError) {
        console.error("Error syncing Microsoft calendar list:", syncError);
        // Don't fail the OAuth flow if sync fails
      }

      // Redirect to app callback page which handles the popup closing
      const appUrl = Deno.env.get("APP_URL") || "http://localhost:3000";
      const callbackUrl = `${appUrl}/auth/callback/microsoft?connectionId=${connectionId}`;

      return new Response(null, {
        status: 302,
        headers: {
          "Location": callbackUrl,
        },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Error</title>
</head>
<body>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({
          type: 'microsoft-calendar-oauth',
          success: false,
          error: 'Internal server error'
        }, '*');
      }
      window.close();
    } catch (e) {
      console.error('Error closing window:', e);
    }
  </script>
  <p>An error occurred. You can close this window.</p>
</body>
</html>`,
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
});
