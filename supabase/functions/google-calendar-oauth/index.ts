import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
    } else {
      // Initiate flow - requires authenticated user
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({
          error: "Unauthorized",
          details: "Missing Authorization header"
        }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      supabaseClient = createClient(
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
        data: { user: authUser },
        error: userError,
      } = await supabaseClient.auth.getUser(token);

      if (userError || !authUser) {
        console.error("Auth error:", userError);
        return new Response(JSON.stringify({
          error: "Unauthorized",
          details: userError?.message || "No user found"
        }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      user = authUser;
    }

    // INITIATE OAUTH FLOW
    if (action === "initiate") {
      // Generate secure random state token
      const state = crypto.randomUUID();

      // Store state in temporary table with expiry (5 minutes)
      const { error: stateError } = await supabaseClient
        .from("oauth_state_tokens")
        .insert({
          state_token: state,
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

      // Build Google OAuth URL
      const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
      const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-oauth`;

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId!);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set(
        "scope",
        "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email"
      );
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("access_type", "offline"); // To get refresh token
      authUrl.searchParams.set("prompt", "consent"); // To ensure refresh token

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
          type: 'oauth-error',
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
            headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
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
          JSON.stringify({ error: "Invalid state parameter" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          JSON.stringify({ error: "State token expired" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Delete used state token
      await supabaseClient
        .from("oauth_state_tokens")
        .delete()
        .eq("state_token", state);

      // Exchange authorization code for tokens
      const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
      const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
      const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-oauth`;

      const tokenResponse = await fetch(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId!,
            client_secret: clientSecret!,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
        }
      );

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error("Token exchange error:", errorData);
        return new Response(
          JSON.stringify({ error: "Failed to exchange authorization code" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const tokens = await tokenResponse.json();

      // Fetch user's email from Google
      const userInfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v1/userinfo",
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        }
      );

      if (!userInfoResponse.ok) {
        console.error("Failed to fetch user info");
        return new Response(
          JSON.stringify({ error: "Failed to fetch user information" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const userInfo = await userInfoResponse.json();
      const email = userInfo.email;

      // Calculate token expiry
      const expiresAt = new Date(
        Date.now() + tokens.expires_in * 1000
      ).toISOString();

      // Insert connection into database
      const { data: connection, error: insertError } = await supabaseClient
        .from("google_calendar_connections")
        .insert({
          user_id: stateData.user_id,
          email: email,
          label: email, // Default label, can be updated later
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error inserting connection:", insertError);

        // Check if it's a duplicate key error
        if (insertError.code === '23505') {
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
          type: 'oauth-error',
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
              headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
            }
          );
        }

        // Other database errors
        console.error("Insert details:", {
          user_id: stateData.user_id,
          email: email,
          expiresAt: expiresAt,
          hasAccessToken: !!tokens.access_token,
          hasRefreshToken: !!tokens.refresh_token
        });
        return new Response(
          `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Connection Failed</title>
</head>
<body>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({
          type: 'oauth-error',
          error: 'Failed to save calendar connection. Please try again.'
        }, '*');
      }
      setTimeout(() => window.close(), 2000);
    } catch (e) {
      console.error('Error closing window:', e);
    }
  </script>
  <p>Failed to save calendar connection. Please try again.</p>
  <p>This window will close automatically...</p>
</body>
</html>`,
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
          }
        );
      }

      // Trigger initial calendar list fetch (skip for now, will be done by client)
      // Note: In callback flow, we don't have an auth token to pass
      // The client will trigger this sync after receiving the success message

      // Return success HTML that closes the popup and notifies parent
      return new Response(
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Authorization Successful</title>
</head>
<body>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({
          type: 'oauth-success',
          connectionId: '${connection.id}'
        }, '*');
      }
      window.close();
    } catch (e) {
      console.error('Error closing window:', e);
    }
  </script>
  <p>Authorization successful! You can close this window.</p>
</body>
</html>`,
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/html; charset=utf-8"
          },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
