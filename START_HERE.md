# St. Thomas Malankara Orthodox Church — Directory App

## Run It Right Now (5 Minutes)

```bash
npm install
npm start
# Login: demo@example.com / demo123
```

No Supabase account needed. Demo mode is on by default.

---

## When You're Ready for Real Data

| Step | Time | Guide |
|---|---|---|
| 1. Supabase setup | 20–30 min | `SETUP_GUIDE.md` |
| 2. Add parish data | 30–60 min | `SETUP_GUIDE.md` |
| 3. QB contribution sync | 20–30 min | `SETUP_GUIDE.md` |

---

## What's Included

- Email/password authentication (Supabase Auth)
- Church directory with family photos
- Parish calendar with event details
- YTD giving summary (synced from QuickBooks Desktop via QB Web Connector)
- Parish documents (tax letters, annual reports)
- Head-of-household access control for contribution data
- Role-based access (admin / member)
- Supabase Row Level Security on all tables

---

## Project Structure

```
StThomasApp/
├── START_HERE.md              ← You are here
├── DEMO_MODE.md               ← Test without Supabase
├── QUICK_START.md             ← Fast setup reference
├── SETUP_GUIDE.md             ← Full step-by-step setup
├── README.md                  ← Complete documentation
│
├── supabase.config.js         ← Add your Supabase URL + key here
├── App.js
├── package.json
├── app.json
│
├── supabase/
│   ├── schema.sql             ← Run once in Supabase SQL Editor
│   ├── qbwc-config.qwc        ← Open in QB Web Connector
│   └── functions/
│       └── qbwc-sync/         ← Edge Function for QB sync
│
└── src/
    ├── screens/
    ├── components/
    ├── services/
    │   ├── authService.js
    │   ├── databaseService.js
    │   ├── storageService.js
    │   └── calendarService.js
    ├── navigation/
    ├── context/
    ├── styles/
    └── utils/
        └── config.js          ← Toggle DEMO_MODE here
```

---

## Toggle Demo / Production

```javascript
// src/utils/config.js
export const DEMO_MODE = true;   // ← demo data, no backend needed
export const DEMO_MODE = false;  // ← connects to Supabase
```

When switching to production, update `supabase.config.js` with your project URL and anon key.

---

## Quick Commands

```bash
npm start           # Start Expo dev server
npm run ios         # iOS simulator (Mac + Xcode required)
npm run android     # Android emulator (Android Studio required)
npx expo start -c   # Clear cache and restart
```

---

## Checklist

- [ ] `npm install` completed
- [ ] App starts with `npm start`
- [ ] Login works with `demo@example.com` / `demo123`
- [ ] Explored Directory, Calendar, and Profile tabs
- [ ] Supabase project created and `schema.sql` run
- [ ] `supabase.config.js` updated with real credentials
- [ ] `DEMO_MODE` set to `false`
- [ ] Parish families, members, and events added
- [ ] QB Web Connector configured for contribution sync
