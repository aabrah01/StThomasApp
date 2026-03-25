# Demo Mode — Test Without Supabase

Demo mode lets you run the full app immediately using local mock data — no Supabase account, no backend, no internet required.

## Quick Start

```bash
npm install
npm start
```

Login with:
- **Email:** `demo@example.com`
- **Password:** `demo123`

That's it — you're in.

---

## What You'll See

### Directory Tab
- 5 sample families (Johnson, Williams, Anderson, Martinez, Davis)
- Johnson and Williams families have stock photos
- Search works with sample data
- Tap any family to see members and contact info

### Calendar Tab
- Sample parish events across multiple dates
- Tap a date to see events for that day

### Profile Tab
- Demo user "John Johnson" (head of household)
- Family photo upload (saves locally in demo)
- **Giving · YTD** section showing sample contributions by category
- **Parish Documents** section with sample tax letter, annual report, and receipt

---

## Demo Data

All mock data lives in `src/utils/demoData.js`:
- **5 families** with addresses and contact info
- **9 members** across the families (John Johnson is flagged as head of household)
- **Parish events** with dates, times, and locations
- **6 YTD contributions** broken down by QB category (Tithe, Building Fund, etc.)
- **3 parish documents** for the current year

---

## Features You Can Test

- ✅ Login / logout
- ✅ Browse and search the directory
- ✅ View family details and members
- ✅ View and tap calendar events
- ✅ Event detail screen
- ✅ Profile page with giving summary and documents
- ✅ Family photo upload (uses local URI in demo)
- ✅ Head-of-household contribution gating
- ✅ Navigation between all screens

---

## Switching to Real Supabase

1. Open `src/utils/config.js` and change:
```javascript
export const DEMO_MODE = false;
```

2. Update `supabase.config.js` with your project credentials:
```javascript
const SUPABASE_URL = 'https://your-project-ref.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

3. Follow `SETUP_GUIDE.md` for the full setup walkthrough.

---

## How Demo Mode Works

The `DEMO_MODE` flag in `src/utils/config.js` controls a branch in every service method:

```
authService.js      → mock login, no Supabase Auth
databaseService.js  → returns data from demoData.js
storageService.js   → returns local URI, no upload
calendarService.js  → returns hardcoded events
```

Simulated network delays (200–500ms) are included so loading states and spinners behave exactly as they would in production.

---

## Customising Demo Data

Edit `src/utils/demoData.js` to test with your own parish data:

```javascript
export const demoFamilies = [
  {
    id: 'family1',
    familyName: 'Your Family Name',
    membershipId: 'MEM001',
    // ...
  },
];
```

Restart the app after saving (`r` in the terminal or shake → Reload in Expo Go).

---

## Troubleshooting

**App won't start:**
```bash
rm -rf node_modules && npm install && npm start
```

**Wrong credentials error:**
- Use exactly `demo@example.com` / `demo123`
- Confirm `DEMO_MODE = true` in `src/utils/config.js`

**Changes not appearing:**
- Press `r` in the terminal, or shake your device and tap **Reload** in Expo Go
