# Google Calendar Integration - User Guide

**Flow** | Calendar Integration v1.0

---

## 🎯 Overview

The Flow now integrates with Google Calendar, allowing you to:
- Connect multiple Google Calendar accounts (personal, work, etc.)
- View events from all your calendars in one place
- Choose which calendars to display
- Real-time syncing with Google Calendar

---

## 🚀 Getting Started

### Step 1: Connect Your First Google Account

1. **Navigate to Settings**
   - Click your profile icon
   - Select "Calendar Connections"
   - Or go to: `/app/settings/calendar-connections`

2. **Click "Connect New Account"**
   - A dialog will appear

3. **Give Your Account a Label** (Optional)
   - Enter a friendly name like "Personal" or "Work"
   - This helps you identify accounts later
   - You can skip this and add a label later

4. **Click "Continue to Google"**
   - You'll be redirected to Google's sign-in page

5. **Sign In & Grant Permissions**
   - Sign in with your Google account
   - Review the permissions requested:
     - Read and write calendar events
     - View your email address
   - Click "Allow"

6. **Return to Flow**
   - You'll be redirected back automatically
   - Your account will appear in the list
   - Calendars will sync automatically

🎉 **Success!** Your first Google account is now connected.

---

## 📅 Managing Calendar Connections

### View All Connected Accounts

Navigate to **Settings → Calendar Connections** to see:
- Account label (e.g., "Personal", "Work")
- Email address
- Number of calendars
- Sync status

### Rename an Account

1. Click the edit icon (✏️) next to the account label
2. Type a new label
3. Press Enter or click the checkmark (✓)

### Sync Calendar List

If you've added or removed calendars in Google Calendar:
1. Click the refresh icon (🔄) on the account card
2. Wait for sync to complete
3. New calendars will appear in the list

### Disconnect an Account

⚠️ **Warning:** This will remove all calendars and events from this account.

1. Click the trash icon (🗑️) on the account card
2. Confirm deletion in the dialog
3. Account and all its data will be removed

---

## 🎨 Choosing Which Calendars to Display

### Toggle Calendar Visibility

In the Calendar Connections settings:
1. Expand an account's calendar list
2. Check/uncheck calendars
3. Changes apply instantly (optimistic updates)
4. Only checked calendars show events in the calendar view

**Color Indicators:**
- Each calendar has a color dot matching its Google Calendar color
- Events display in their calendar's color

---

## 📆 Using the Calendar View

### Accessing the Calendar

Navigate to **Calendar** in the main navigation.

### View Types

**Week View** (Default)
- Shows 7 days (Sunday - Saturday)
- All-day events at the top
- Hourly time slots below
- Best for desktop/tablet

**Day View**
- Shows 24 hours for a single day
- More space for event details
- Best for mobile or focused work

**Switch Views:**
- Click "Day" or "Week" button in the header

### Navigation

**Move Forward/Backward:**
- Click the left arrow (←) to go back
- Click the right arrow (→) to go forward
- Day view: moves by 1 day
- Week view: moves by 1 week

**Return to Today:**
- Click "Today" button
- Current day highlights in blue

### Viewing Event Details

**Click on any event** to see details (if implemented):
- Event title
- Start and end time
- Location
- Description
- Calendar name

---

## 🔄 Syncing Events

### Automatic Sync

Events sync automatically every 5 minutes (if cron job is configured).

### Manual Sync

1. Click the refresh icon (🔄) in the calendar header
2. A spinner indicates syncing
3. New/updated/deleted events appear immediately

### What Gets Synced

✅ **Synced:**
- Event title
- Start and end times
- All-day events
- Multi-day events
- Recurring events (each instance)
- Event location
- Event description
- Event colors

❌ **Not Synced:**
- Event attendees
- Event attachments
- Event reminders (use Google Calendar app)

---

## 💡 Tips & Best Practices

### Multiple Accounts

**Recommended Labels:**
- "Personal" for your main Gmail
- "Work" for work email
- "Family" for shared family calendar
- "Contracted" for client/contractor accounts

### Calendar Organization

**Hide Calendars You Don't Need:**
- Uncheck calendars you rarely use
- They stay synced but hidden from view
- Re-enable anytime

**Use Colors:**
- Events display in their calendar's color
- Helps distinguish work vs personal at a glance

### Performance Tips

**For Best Performance:**
- Only show calendars you actively use
- Disconnect unused accounts
- Refresh occasionally to keep data fresh

---

## 🔐 Privacy & Security

### What We Access

The app can:
- Read your calendar events
- Read your email address (for identification)

### What We Store

We store:
- Your calendar events (cached for performance)
- Calendar names and colors
- Connection details (encrypted tokens)

### What We Don't Do

We do NOT:
- Share your data with third parties
- Use your data for advertising
- Access your emails or other Google services

### Token Security

- Access tokens are encrypted in our database
- Tokens refresh automatically
- You can disconnect anytime to revoke access

---

## ⚠️ Troubleshooting

### "Re-authentication Required" Warning

**Cause:** Your access token has expired or been revoked.

**Solution:**
1. Click "Disconnect" on the problematic account
2. Reconnect the account
3. Grant permissions again

### Events Not Appearing

**Check:**
1. Is the calendar checked in the picker?
2. Is the event in the current date range?
3. Try manual sync (refresh button)
4. Check if event exists in Google Calendar

### Sync Taking Too Long

**Try:**
1. Refresh the page
2. Disconnect and reconnect account
3. Check your internet connection
4. If problem persists, contact support

### Calendar Colors Wrong

**Solution:**
1. Click sync button on the account
2. This refreshes calendar metadata
3. Colors should update

### Can't Connect Account

**Check:**
1. Are you signed in to Google?
2. Did you grant all permissions?
3. Is your Google account 2FA protected? (make sure you approve)
4. Try in an incognito/private window

---

## 🆘 Getting Help

### Need More Help?

**Contact Support:**
- Email: support@flowapp.com
- Include: Account email, error message, screenshots

**Check Documentation:**
- [Troubleshooting Guide](./CALENDAR_TROUBLESHOOTING.md)
- [FAQ](./CALENDAR_FAQ.md)

---

## 🚀 Coming Soon

Future features we're working on:
- ✨ Create events from Flow
- ✨ Edit events directly in app
- ✨ Link tasks to calendar events
- ✨ Two-way sync
- ✨ Microsoft Outlook integration
- ✨ Apple Calendar integration

---

## 📝 Feedback

We'd love to hear from you!

**Found a bug?** Report it at: bugs@flowapp.com

**Have a feature request?** Let us know: feedback@flowapp.com

**Enjoying the feature?** Leave us a review!

---

**Last Updated:** October 2, 2025
**Version:** 1.0
**Platform:** Web, iOS, Android, Desktop
