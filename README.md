# St. Thomas Malankara Orthodox Church — Directory App

A cross-platform mobile application (iOS + Android) for managing the parish directory, events, YTD contributions, and parish documents.

## Features

- **Church Directory** — Browse families with photos, addresses, and contact information
- **Member Management** — View family members with roles and contact details
- **Parish Events** — Calendar view of church events managed in-app
- **User Authentication** — Secure email/password login via Supabase Auth
- **YTD Contributions** — Head-of-household members can view their giving summary (synced from QuickBooks Desktop via QB Web Connector)
- **Parish Documents** — Tax letters, annual reports, and receipts shared by administration
- **Family Photos** — Members can upload a photo for their own family
- **Search** — Find families quickly by name
- **Role-Based Access** — Admin and member roles with appropriate permissions

## Technology Stack

- **Framework** — React Native with Expo (managed workflow)
- **Backend** — Supabase (Auth, PostgreSQL database, Storage)
- **Contributions Sync** — QuickBooks Web Connector → Supabase Edge Function
- **Navigation** — React Navigation (Stack + Bottom Tabs)
- **Language** — JavaScript

## Prerequisites

- Node.js 18+ and npm
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (Mac only) or Android Studio
- Expo Go app on your phone (for testing)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the schema in **Supabase Dashboard → SQL Editor**:
   - Open `supabase/schema.sql` and paste the full contents, then click **Run**
3. Create a Storage bucket:
   - Go to **Storage → New Bucket**
   - Name: `family-photos`, set to **Public**
4. Get your credentials from **Project Settings → API**
5. Update `supabase.config.js`:

```javascript
const SUPABASE_URL = 'https://your-project-ref.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

### 3. Create User Accounts

1. Go to **Supabase Dashboard → Authentication → Users → Invite user**
2. After users sign up, insert a row in the `members` table linking their `user_id`
3. Insert a row in `user_roles` for each user (`role`: `'admin'` or `'member'`)
4. Set `is_head_of_household = true` on one member per family to enable contribution viewing

### 4. Add Initial Data

All tables are defined in `supabase/schema.sql`. Use the Supabase **Table Editor** or SQL to insert:
- **families** — family name, address, contact info
- **members** — linked to families and Supabase Auth users
- **events** — parish calendar events
- **documents** — parish documents (tax letters, reports)

### 5. QuickBooks Desktop Sync (Contributions)

See `supabase/qbwc-config.qwc` and the Edge Function at `supabase/functions/qbwc-sync/index.ts`.

1. Deploy the Edge Function:
```bash
npx supabase functions deploy qbwc-sync
```
2. Set secrets:
```bash
npx supabase secrets set QBWC_USERNAME=qbwc QBWC_PASSWORD=your-strong-password
```
3. Open `supabase/qbwc-config.qwc` in QuickBooks Web Connector on the Windows machine running QB Desktop
4. Schedule nightly sync (1440 minutes)

## Running the App

```bash
# Start Expo development server
npm start

# Run on iOS Simulator (Mac only)
npm run ios

# Run on Android Emulator
npm run android

# Scan QR code with Expo Go app on your phone
```

## Demo Mode

The app ships with demo mode enabled — no Supabase account needed to test:

```bash
npm install
npm start
# Login: demo@example.com / demo123
```

To switch to real Supabase, open `src/utils/config.js` and set:
```javascript
export const DEMO_MODE = false;
```

## Project Structure

```
StThomasApp/
├── App.js                       # Main app entry point
├── supabase.config.js           # Supabase client initialization
├── app.json                     # Expo configuration
├── package.json                 # Dependencies
│
├── supabase/
│   ├── schema.sql               # Run once in Supabase SQL Editor
│   ├── qbwc-config.qwc          # Open in QB Web Connector
│   └── functions/
│       └── qbwc-sync/
│           └── index.ts         # Edge Function for QB contribution sync
│
└── src/
    ├── navigation/
    │   └── AppNavigator.js
    ├── screens/
    │   ├── auth/
    │   ├── directory/
    │   ├── calendar/
    │   └── profile/
    ├── components/
    │   ├── common/
    │   ├── directory/
    │   └── calendar/
    ├── services/
    │   ├── authService.js       # Supabase Auth
    │   ├── databaseService.js   # Supabase database queries
    │   ├── storageService.js    # Supabase Storage
    │   └── calendarService.js
    ├── context/
    │   └── AuthContext.js
    ├── styles/
    │   ├── theme.js
    │   └── commonStyles.js
    └── utils/
        ├── config.js            # DEMO_MODE flag
        ├── demoData.js
        └── constants.js
```

## Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure
eas build:configure

# Build
eas build --platform ios
eas build --platform android

# Submit to App Stores
eas submit --platform ios
eas submit --platform android
```

## Over-the-Air Updates

```bash
eas update --branch production
```

## Cost Breakdown

### One-Time Costs
- Apple Developer Account: $99/year
- Google Play Developer Account: $25 one-time

### Monthly Costs
- Supabase: Free tier (500 MB DB, 1 GB storage) is sufficient for most parishes
  - If exceeded: Pro plan ~$25/month
- Expo EAS: Free tier includes 30 builds/month

## Security Best Practices

1. Never commit `supabase.config.js` with real credentials to public repos
2. Row Level Security (RLS) is enabled on all tables — see `supabase/schema.sql`
3. Contribution data is restricted to head-of-household members at both the app and database level
4. Use Supabase environment secrets for the QB Web Connector password
5. Regularly review Supabase Dashboard → Logs for unusual activity

## License

This project is private and proprietary to St. Thomas Malankara Orthodox Church, Long Island, NY.

## Version

Current Version: 1.0.0
