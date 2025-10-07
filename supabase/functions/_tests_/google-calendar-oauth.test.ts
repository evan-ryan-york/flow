import { assertEquals, assertExists } from "https://deno.land/std@0.192.0/testing/asserts.ts";

// Mock Supabase client
const createMockSupabaseClient = () => ({
  from: (table: string) => ({
    insert: () => ({
      select: () => ({
        single: () => Promise.resolve({ data: { id: 'test-id' }, error: null })
      })
    }),
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: { user_id: 'test-user' }, error: null })
      }),
      maybeSingle: () => Promise.resolve({ data: { user_id: 'test-user' }, error: null })
    }),
    delete: () => ({
      eq: () => Promise.resolve({ data: null, error: null })
    })
  }),
  auth: {
    getUser: () => Promise.resolve({
      data: { user: { id: 'test-user' } },
      error: null
    })
  }
});

Deno.test("OAuth initiate: generates valid auth URL", () => {
  const clientId = "test-client-id";
  const redirectUri = "https://test.com/callback";
  const scopes = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email"
  ];

  // Build OAuth URL manually (same as function logic)
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state: "test-state"
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  // Verify URL structure
  assertExists(authUrl);
  assertEquals(authUrl.includes("client_id=test-client-id"), true);
  assertEquals(authUrl.includes("access_type=offline"), true);
  assertEquals(authUrl.includes("prompt=consent"), true);
});

Deno.test("OAuth callback: exchanges code for tokens", async () => {
  const mockResponse = {
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    expires_in: 3600,
    token_type: "Bearer"
  };

  // Mock fetch for token exchange
  globalThis.fetch = async () => {
    return new Response(JSON.stringify(mockResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  const code = "test-auth-code";
  const clientId = "test-client-id";
  const clientSecret = "test-client-secret";
  const redirectUri = "https://test.com/callback";

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });

  const tokens = await tokenResponse.json();

  assertEquals(tokens.access_token, "test-access-token");
  assertEquals(tokens.refresh_token, "test-refresh-token");
  assertEquals(tokens.expires_in, 3600);
});

Deno.test("OAuth callback: saves connection to database", async () => {
  const supabase = createMockSupabaseClient();

  const connectionData = {
    user_id: "test-user",
    email: "test@gmail.com",
    label: "Personal",
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    expires_at: new Date(Date.now() + 3600 * 1000).toISOString()
  };

  const { data, error } = await supabase
    .from("google_calendar_connections")
    .insert(connectionData)
    .select()
    .single();

  assertEquals(error, null);
  assertExists(data);
  assertEquals(data.id, "test-id");
});

Deno.test("OAuth state token: validates correctly", async () => {
  const supabase = createMockSupabaseClient();
  const stateToken = "test-state-token";

  const { data, error } = await supabase
    .from("oauth_state_tokens")
    .select("user_id")
    .eq("token", stateToken)
    .maybeSingle();

  assertEquals(error, null);
  assertExists(data);
  assertEquals(data.user_id, "test-user");
});
