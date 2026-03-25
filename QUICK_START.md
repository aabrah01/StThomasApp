# Quick Start Guide

## Try It Now — No Backend Needed

```bash
# 1. Install dependencies
npm install

# 2. Start the app
npm start

# 3. Scan QR code with Expo Go (iOS/Android)
# 4. Login with demo credentials:
#    Email:    demo@example.com
#    Password: demo123
```

Demo mode is on by default — no Supabase account needed.

---

## Switching to Real Supabase

Before the app will work with real data, you need to:

1. **Create a Supabase project** at https://supabase.com
   - Run `supabase/schema.sql` in the SQL Editor
   - Create a Storage bucket named `family-photos` (set to Public)
   - Update `supabase.config.js` with your Project URL and anon key

2. **Turn off demo mode**
   ```javascript
   // src/utils/config.js
   export const DEMO_MODE = false;
   ```

3. **Create users** via Supabase Dashboard → Authentication → Invite user
   - Link each user to a `members` row via `user_id`
   - Add a `user_roles` row for each user

4. **Add parish data** — families, members, events, documents — via Table Editor

See `SETUP_GUIDE.md` for detailed step-by-step instructions.

---

## Common Commands

```bash
# Start development server
npm start

# Run on iOS simulator (Mac only)
npm run ios

# Run on Android emulator
npm run android

# Clear cache and restart
npx expo start -c
```

---

## Troubleshooting

**App won't start:**
```bash
rm -rf node_modules && npm install && npm start
```

**Login fails in demo mode:**
- Use exact credentials: `demo@example.com` / `demo123`
- Confirm `DEMO_MODE = true` in `src/utils/config.js`

**Login fails with real Supabase:**
- Check `supabase.config.js` has the correct URL and anon key
- Confirm the user exists in Supabase Authentication
- Confirm a `user_roles` row exists for that user

**No data showing:**
- Confirm families and members are inserted in Supabase
- Check RLS policies are active (re-run `supabase/schema.sql` if needed)

---

## Project Structure

```
src/
├── navigation/      # App navigation
├── screens/         # All screens (auth, directory, calendar, profile)
├── components/      # Reusable UI components
├── services/        # Supabase & API services
│   ├── authService.js
│   ├── databaseService.js
│   ├── storageService.js
│   └── calendarService.js
├── context/         # Auth state
├── styles/          # Theme and common styles
└── utils/           # Config, demo data, constants
```

## Key Files

| File | Purpose |
|---|---|
| `supabase.config.js` | Supabase client — add your URL + anon key here |
| `src/utils/config.js` | Toggle `DEMO_MODE` here |
| `supabase/schema.sql` | Run once in Supabase SQL Editor |
| `supabase/qbwc-config.qwc` | Open in QB Web Connector for contribution sync |
