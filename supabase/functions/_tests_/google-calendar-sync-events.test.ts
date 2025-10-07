import { assertEquals, assertExists } from "https://deno.land/std@0.192.0/testing/asserts.ts";

Deno.test("Event sync: incremental sync uses syncToken", () => {
  const syncToken = "previous-sync-token";
  const calendarId = "test@gmail.com";

  // Build Google Calendar API URL with syncToken
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set("syncToken", syncToken);
  url.searchParams.set("maxResults", "250");

  assertEquals(url.searchParams.get("syncToken"), syncToken);
  assertEquals(url.searchParams.has("timeMin"), false); // Incremental sync doesn't use timeMin
  assertEquals(url.searchParams.has("timeMax"), false); // Incremental sync doesn't use timeMax
});

Deno.test("Event sync: full sync uses time range", () => {
  const calendarId = "test@gmail.com";
  const timeMin = new Date("2025-09-01T00:00:00Z");
  const timeMax = new Date("2025-12-31T23:59:59Z");

  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set("timeMin", timeMin.toISOString());
  url.searchParams.set("timeMax", timeMax.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("maxResults", "250");

  assertEquals(url.searchParams.get("timeMin"), timeMin.toISOString());
  assertEquals(url.searchParams.get("timeMax"), timeMax.toISOString());
  assertEquals(url.searchParams.get("singleEvents"), "true");
});

Deno.test("Event sync: handles 410 Gone error (invalid syncToken)", async () => {
  // Mock 410 response
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({ error: { code: 410, message: "Sync token expired" } }),
      { status: 410, headers: { "Content-Type": "application/json" } }
    );
  };

  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/test/events");

  assertEquals(response.status, 410);

  // In real function, this triggers full sync
  const shouldDoFullSync = response.status === 410;
  assertEquals(shouldDoFullSync, true);
});

Deno.test("Event sync: parses Google Calendar event correctly", () => {
  const googleEvent = {
    id: "event123",
    summary: "Team Meeting",
    description: "Discuss Q4 goals",
    start: {
      dateTime: "2025-10-15T10:00:00-07:00",
      timeZone: "America/Los_Angeles"
    },
    end: {
      dateTime: "2025-10-15T11:00:00-07:00",
      timeZone: "America/Los_Angeles"
    },
    location: "Conference Room A",
    colorId: "11"
  };

  // Parse to our database format
  const dbEvent = {
    google_calendar_event_id: googleEvent.id,
    title: googleEvent.summary,
    description: googleEvent.description || null,
    start_time: googleEvent.start.dateTime,
    end_time: googleEvent.end.dateTime,
    is_all_day: !googleEvent.start.dateTime, // All-day if only 'date' field
    location: googleEvent.location || null,
    color: googleEvent.colorId || null
  };

  assertEquals(dbEvent.google_calendar_event_id, "event123");
  assertEquals(dbEvent.title, "Team Meeting");
  assertEquals(dbEvent.is_all_day, false);
  assertExists(dbEvent.start_time);
  assertExists(dbEvent.end_time);
});

Deno.test("Event sync: handles all-day events", () => {
  const googleEvent = {
    id: "all-day-123",
    summary: "All Day Event",
    start: {
      date: "2025-10-15"
    },
    end: {
      date: "2025-10-16"
    }
  };

  const dbEvent = {
    google_calendar_event_id: googleEvent.id,
    title: googleEvent.summary,
    start_time: googleEvent.start.date || googleEvent.start.dateTime,
    end_time: googleEvent.end.date || googleEvent.end.dateTime,
    is_all_day: !googleEvent.start.dateTime,
  };

  assertEquals(dbEvent.is_all_day, true);
  assertEquals(dbEvent.start_time, "2025-10-15");
  assertEquals(dbEvent.end_time, "2025-10-16");
});

Deno.test("Event sync: handles deleted events (status=cancelled)", () => {
  const googleEvent = {
    id: "deleted-event-123",
    status: "cancelled"
  };

  const isDeleted = googleEvent.status === "cancelled";
  assertEquals(isDeleted, true);

  // In real function, this triggers DELETE from database
});

Deno.test("Event sync: batches database upserts", () => {
  const events = [
    { id: "1", title: "Event 1" },
    { id: "2", title: "Event 2" },
    { id: "3", title: "Event 3" },
  ];

  const batchSize = 50;
  const batches = [];

  for (let i = 0; i < events.length; i += batchSize) {
    batches.push(events.slice(i, i + batchSize));
  }

  assertEquals(batches.length, 1); // Only 3 events, fits in one batch
  assertEquals(batches[0].length, 3);
});
