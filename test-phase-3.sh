#!/bin/bash

# Phase 3 Edge Functions Test Script
# This script helps you test the Google Calendar integration backend

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
# Set your Supabase project URL here or via environment variable
BASE_URL="${SUPABASE_URL:-https://<your-supabase-project>.supabase.co}/functions/v1"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️  jq is not installed. Install it for better output formatting:${NC}"
    echo "   brew install jq   (macOS)"
    echo "   sudo apt install jq   (Linux)"
    echo ""
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Phase 3 Edge Functions Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check for required environment variables
if [ -z "$USER_JWT" ]; then
    echo -e "${YELLOW}⚠️  USER_JWT not set. Get it from your app:${NC}"
    echo "   1. Login to your app"
    echo "   2. Open browser console"
    echo "   3. Run: const session = await supabase.auth.getSession();"
    echo "   4. Copy: session.data.session.access_token"
    echo "   5. Export: export USER_JWT='your_token_here'"
    echo ""
    read -p "Enter your USER JWT token: " USER_JWT
fi

if [ -z "$SERVICE_KEY" ]; then
    echo -e "${YELLOW}⚠️  SERVICE_KEY not set. Get it from Supabase Dashboard:${NC}"
    echo "   Settings → API → service_role key"
    echo ""
    read -p "Enter your SERVICE_ROLE_KEY: " SERVICE_KEY
fi

echo ""

# Test 1: OAuth Initiate
echo -e "${BLUE}1️⃣  Testing OAuth Initiate Endpoint...${NC}"
OAUTH_RESPONSE=$(curl -s "$BASE_URL/google-calendar-oauth?action=initiate" \
  -H "Authorization: Bearer $USER_JWT")

if echo "$OAUTH_RESPONSE" | grep -q "authUrl"; then
    echo -e "${GREEN}✅ OAuth Initiate: SUCCESS${NC}"
    AUTH_URL=$(echo "$OAUTH_RESPONSE" | jq -r '.authUrl' 2>/dev/null || echo "$OAUTH_RESPONSE" | grep -o 'https://accounts.google.com[^"]*')
    echo -e "${YELLOW}📋 OAuth URL generated:${NC}"
    echo "   $AUTH_URL"
    echo ""
    echo -e "${YELLOW}👉 Next steps:${NC}"
    echo "   1. Open the URL above in your browser"
    echo "   2. Authorize with your Google account"
    echo "   3. You'll be redirected back to the callback"
    echo ""
else
    echo -e "${RED}❌ OAuth Initiate: FAILED${NC}"
    echo "Response: $OAUTH_RESPONSE"
    echo ""
fi

read -p "Press Enter after completing OAuth flow in browser..."

# Test 2: Check Connection Created
echo ""
echo -e "${BLUE}2️⃣  Checking if connection was created...${NC}"
echo "Run this SQL query in Supabase SQL Editor:"
echo ""
echo -e "${YELLOW}SELECT id, email, label, expires_at FROM google_calendar_connections ORDER BY created_at DESC LIMIT 1;${NC}"
echo ""
read -p "Enter your connection ID: " CONNECTION_ID

if [ -z "$CONNECTION_ID" ]; then
    echo -e "${RED}❌ No connection ID provided. Skipping remaining tests.${NC}"
    exit 1
fi

# Test 3: Calendar List Sync
echo ""
echo -e "${BLUE}3️⃣  Testing Calendar List Sync...${NC}"
CALENDAR_SYNC_RESPONSE=$(curl -s -X POST "$BASE_URL/google-calendar-sync-calendars" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"connectionId\":\"$CONNECTION_ID\"}")

if echo "$CALENDAR_SYNC_RESPONSE" | grep -q "Synced"; then
    echo -e "${GREEN}✅ Calendar List Sync: SUCCESS${NC}"
    if command -v jq &> /dev/null; then
        echo "$CALENDAR_SYNC_RESPONSE" | jq
    else
        echo "$CALENDAR_SYNC_RESPONSE"
    fi
    echo ""
else
    echo -e "${RED}❌ Calendar List Sync: FAILED${NC}"
    echo "Response: $CALENDAR_SYNC_RESPONSE"
    echo ""
fi

# Test 4: Event Sync
echo -e "${BLUE}4️⃣  Testing Event Sync...${NC}"
EVENT_SYNC_RESPONSE=$(curl -s -X POST "$BASE_URL/google-calendar-sync-events" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"connectionId\":\"$CONNECTION_ID\"}")

if echo "$EVENT_SYNC_RESPONSE" | grep -q "Synced"; then
    echo -e "${GREEN}✅ Event Sync: SUCCESS${NC}"
    if command -v jq &> /dev/null; then
        echo "$EVENT_SYNC_RESPONSE" | jq
    else
        echo "$EVENT_SYNC_RESPONSE"
    fi
    echo ""
else
    echo -e "${RED}❌ Event Sync: FAILED${NC}"
    echo "Response: $EVENT_SYNC_RESPONSE"
    echo ""
fi

# Test 5: Token Refresh
echo -e "${BLUE}5️⃣  Testing Token Refresh...${NC}"
TOKEN_REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/google-calendar-refresh-token" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"connectionId\":\"$CONNECTION_ID\"}")

if echo "$TOKEN_REFRESH_RESPONSE" | grep -q "Refreshed"; then
    echo -e "${GREEN}✅ Token Refresh: SUCCESS${NC}"
    if command -v jq &> /dev/null; then
        echo "$TOKEN_REFRESH_RESPONSE" | jq
    else
        echo "$TOKEN_REFRESH_RESPONSE"
    fi
    echo ""
else
    echo -e "${YELLOW}⚠️  Token Refresh: Token may not need refresh yet${NC}"
    echo "Response: $TOKEN_REFRESH_RESPONSE"
    echo ""
fi

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Run these SQL queries to verify data:"
echo ""
echo -e "${YELLOW}-- Check calendar subscriptions:${NC}"
echo "SELECT calendar_name, is_visible, sync_enabled FROM calendar_subscriptions WHERE connection_id = '$CONNECTION_ID';"
echo ""
echo -e "${YELLOW}-- Check synced events:${NC}"
echo "SELECT title, start_time, is_all_day FROM calendar_events WHERE connection_id = '$CONNECTION_ID' ORDER BY start_time DESC LIMIT 10;"
echo ""
echo -e "${YELLOW}-- Check sync state:${NC}"
echo "SELECT cs.calendar_name, css.last_sync_at, css.sync_token IS NOT NULL as has_incremental_sync"
echo "FROM calendar_sync_state css"
echo "JOIN calendar_subscriptions cs ON css.subscription_id = cs.id"
echo "WHERE cs.connection_id = '$CONNECTION_ID';"
echo ""
echo -e "${GREEN}✅ Phase 3 testing complete!${NC}"
echo ""
echo "📖 For detailed testing guide, see: docs/phase-3-testing-guide.md"
