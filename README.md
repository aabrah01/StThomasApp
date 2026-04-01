# St. Thomas Malankara Orthodox Church — Directory App

A cross-platform mobile application (iOS + Android) for managing the parish directory, events, YTD contributions, and parish documents. Includes a web-based admin console for staff.

## Features

- **Church Directory** — Browse families with photos, addresses, and contact information
- **Member Management** — View family members with roles and contact details
- **Parish Events** — Calendar view of church events
- **User Authentication** — Secure email/password login via Supabase Auth
- **YTD Contributions** — Head-of-household members can view their giving summary (synced from QuickBooks Desktop)
- **Parish Documents** — Tax letters, annual reports, and receipts shared by administration
- **Family Photos** — Members can upload a photo for their own family
- **Role-Based Access** — Admin and member roles with appropriate permissions
- **Admin Console** — Web-based dashboard for managing all parish data

## Technology Stack

- **Mobile App** — React Native with Expo SDK 54
- **Admin Console** — Next.js 16 with Tailwind CSS
- **Backend** — Supabase (Auth, PostgreSQL, Storage)
- **Contributions Sync** — QuickBooks Web Connector → Supabase Edge Function

---

## Full Deployment Guide

Follow these phases in order. Estimated total time: **2–3 hours** for a first-time setup.

---

## Phase 1 — Supabase Backend Setup

Everything runs on Supabase. Do this before touching the mobile app or admin console.

### Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (free account)
2. Click **New Project**
3. Name it `st-thomas-app`, choose a strong database password, select the **US East** region
4. Wait ~2 minutes for it to provision

### Step 2 — Run the database schema

1. In your Supabase project, go to **SQL Editor → New Query**
2. Open `supabase/schema.sql` from this repo
3. Paste the entire contents and click **Run**

This creates all tables: `families`, `members`, `user_roles`, `events`, `documents`, `contributions`, `qbwc_sessions`, `audit_log` — with Row Level Security enabled on all of them.

### Step 3 — Create the storage bucket

Storage buckets cannot be created via SQL — use the dashboard:

1. Go to **Storage → New Bucket**
2. Name: `family-photos`
3. Toggle **Public bucket: OFF** (must be private)
4. Click **Create bucket**

Then add the storage access policies. Go to **SQL Editor → New Query** and run:

```sql
create policy "auth_read_family_photos" on storage.objects
  for select using (bucket_id = 'family-photos' and auth.role() = 'authenticated');

create policy "auth_upload_family_photos" on storage.objects
  for insert with check (bucket_id = 'family-photos' and auth.role() = 'authenticated');

create policy "auth_update_family_photos" on storage.objects
  for update using (bucket_id = 'family-photos' and auth.role() = 'authenticated');
```

### Step 4 — Get your API credentials

Go to **Project Settings → API** and copy:

| Value | Where to find it |
|---|---|
| Project URL | `https://abcxyz.supabase.co` |
| anon / public key | Under "Project API Keys" |
| service_role key | Under "Project API Keys" (keep this secret) |

### Step 5 — Add credentials to the mobile app

Open `supabase.config.js` in the root of this repo and replace the placeholder values:

```javascript
const SUPABASE_URL = 'https://your-project-ref.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

Then turn off demo mode. Open `src/utils/config.js` and set:

```javascript
export const DEMO_MODE = false;
```

### Step 6 — Add credentials to the admin console

Open `admin-console/.env.local` and fill in all values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_SITE_URL=https://your-admin-console-domain.com
NEXT_PUBLIC_DEMO_MODE=false
```

### Step 7 — Create the first admin account

1. Go to **Supabase Dashboard → Authentication → Users → Add user**
2. Enter the admin's email and a temporary password
3. Copy the user's UUID from the users list
4. Go to **SQL Editor** and run:

```sql
insert into user_roles (user_id, role)
values ('paste-the-uuid-here', 'admin');
```

The admin can now log into the admin console at `http://localhost:3000` and manage everything from there.

---

## Phase 2 — Enter Family & Member Data

### Option A — Admin Console (recommended for initial setup)

```bash
cd admin-console
npm install
npm run dev
```

Open `http://localhost:3000`, log in with the admin account, then:

1. **Families → Add Family** — Enter family name, address, phone, email, membership ID
2. Add all members inline — check **Head of Household** for one member per family
3. **Users → Invite User** — Enter head-of-household email, role: Member
4. They receive an email with a link to set their password

The head-of-household designation controls who can see YTD contribution totals in the mobile app.

### Option B — CSV Spreadsheet Import (faster for large churches)

Prepare a CSV with these columns and import via **Supabase → Table Editor → Import CSV**:

**families.csv**
```
family_name, membership_id, address, city, state, zip, phone, email
Abraham Family, 001, 123 Oak St, Troy, MI, 48083, 248-555-1234, george@email.com
```

**members.csv** (then run the SQL below to link family IDs)
```
first_name, last_name, email, phone_number, role, is_head_of_household, temp_family_name
George, Abraham, george@email.com, 248-555-1234, Father, true, Abraham Family
```

After importing members, link them to families:

```sql
update members m
set family_id = f.id
from families f
where m.temp_family_name = f.family_name;

alter table members drop column temp_family_name;
```

---

## Phase 3 — QuickBooks Contributions Data

### Option A — CSV Import (start here for historical data)

1. In QuickBooks Desktop → **Reports → Accountant & Taxes → Transaction Detail by Account**
2. Set date range to the full year, export to CSV
3. Rename columns to match:

| QuickBooks column | Rename to |
|---|---|
| Name | customer |
| Date | date |
| Amount | amount |
| Account / Item | category |
| Memo | memo |

4. Admin console → **Contributions → CSV Import** → upload the file → preview → Import

> Family names in the CSV must exactly match the `family_name` in the database (case-insensitive).

### Option B — Nightly Automatic Sync via QuickBooks Web Connector

**Requires:** QuickBooks Desktop on a Windows PC that stays on overnight.

**1. Deploy the Edge Function:**

```bash
npm install -g supabase
supabase login
supabase link --project-ref your-project-ref
supabase functions deploy qbwc-sync
```

**2. Set secrets:**

```bash
supabase secrets set QBWC_USERNAME=qbwc
supabase secrets set QBWC_PASSWORD=choose_a_strong_password
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**3. Update the `.qwc` config file:**

Open `supabase/qbwc-config.qwc` and replace `YOUR_PROJECT_REF` with your actual Supabase project ref in the two `<AppURL>` and `<AppSupport>` lines.

**4. Install QB Web Connector on the Windows PC:**

- Download free from [developer.intuit.com](https://developer.intuit.com/app/developer/qbdesktop/docs/get-started/qbwebconnector)
- Open Web Connector → **Add an Application** → select `supabase/qbwc-config.qwc`
- QuickBooks asks permission → click **Yes, always allow**
- Enter the `QBWC_PASSWORD` when prompted
- Set **Run Every**: `1440` minutes (nightly)
- Click **Update Selected** to test immediately — Status should show `200 - OK`

> Note: The sync pulls Sales Receipts by default. If your bookkeeper uses a different QB transaction type (Deposits, Receive Payments, Journal Entries), let your developer know so the Edge Function query can be updated.

---

## Phase 4 — Deploy the Admin Console

The admin console is a Next.js web app. Deploy it to [Vercel](https://vercel.com) (free tier is sufficient).

### Deploy to Vercel

```bash
npm install -g vercel
cd admin-console
vercel
```

Vercel will ask a few questions:
- Link to existing project? **No** → creates a new one
- Project name: `st-thomas-admin`
- Directory: `.` (current)

After deploy, go to your Vercel project → **Settings → Environment Variables** and add all variables from `admin-console/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL        ← set this to your Vercel URL, e.g. https://st-thomas-admin.vercel.app
NEXT_PUBLIC_DEMO_MODE       ← set to false
```

Then redeploy: `vercel --prod`

---

## Phase 5 — Deploy the Mobile App

### Prerequisites

| Account | Cost | Link |
|---|---|---|
| Apple Developer Program | $99/year | developer.apple.com/programs |
| Google Play Developer | $25 one-time | play.google.com/console |
| Expo account (existing) | Free | expo.dev |

```bash
npm install -g eas-cli
eas login   # use your existing Expo credentials
```

### Step 1 — Verify app.json

`app.json` is pre-configured with:
- iOS bundle ID: `com.stthomas.directory`
- Android package: `com.stthomas.directory`

These are globally unique identifiers. If another app already uses these, you'll need to change them (e.g. `com.stthomasli.directory`).

### Step 2 — Store Supabase credentials securely

Do not put credentials in source code. Store them as EAS secrets:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-project.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-anon-key"
```

### Step 3 — Configure EAS

```bash
eas build:configure
```

Accept all defaults. This creates `eas.json`.

### Step 4 — iOS: Build and submit to TestFlight

```bash
# Build (EAS manages signing certs automatically — say Yes when asked)
eas build --platform ios --profile production

# Submit to App Store Connect (~15–20 min build time)
eas submit --platform ios
```

In [App Store Connect](https://appstoreconnect.apple.com):
- Go to your app → **TestFlight** tab
- **Internal Testing**: add admins — instant access, no review
- **External Testing**: add testers by email — Apple does a ~24 hr review first
- Testers install the **TestFlight app** on their iPhone, then tap the invite link

### Step 5 — Android: Build and submit to Google Play Internal Testing

```bash
# Build (EAS manages the keystore automatically — say Yes when asked)
eas build --platform android --profile production
```

**First upload must be done manually** (Google requirement):

1. Go to [play.google.com/console](https://play.google.com/console) → Create app
2. Fill in app details, complete the setup checklist (requires a privacy policy URL)
3. Go to **Testing → Internal Testing → Create release**
4. Download the `.aab` file from `eas.dev` after the build completes
5. Upload the `.aab` → Save → Review → Roll out
6. Add testers by email under the **Testers** tab

After the first manual upload, future releases can be automated:

```bash
eas submit --platform android
```

### Version Bumps (for every future update)

Before each new build, increment the version numbers in `app.json`:

```json
"version": "1.0.1",
"ios": { "buildNumber": "2" },
"android": { "versionCode": 2 }
```

---

## Running Locally (Development)

```bash
# Mobile app
npm install
npm start          # scan QR code with Expo Go app on your phone
npm run ios        # iOS Simulator (Mac only)
npm run android    # Android Emulator

# Admin console
cd admin-console
npm install
npm run dev        # opens at http://localhost:3000
```

**Demo mode** is enabled by default — no Supabase account needed:
```
Mobile app login: demo@example.com / demo123
Admin console: click "Enter Demo Mode"
```

---

## Project Structure

```
StThomasApp/
├── App.js                        # Mobile app entry point
├── supabase.config.js            # Supabase client (add your credentials here)
├── app.json                      # Expo / EAS configuration
├── package.json
│
├── supabase/
│   ├── schema.sql                # Run once in Supabase SQL Editor
│   ├── qbwc-config.qwc           # Open in QB Web Connector on Windows
│   └── functions/qbwc-sync/      # Edge Function for nightly QB sync
│       └── index.ts
│
├── admin-console/                # Next.js web admin dashboard
│   ├── .env.local                # Admin console credentials (never commit)
│   ├── app/                      # Next.js App Router pages
│   ├── lib/                      # Supabase client, auth guard, validators
│   └── components/               # Shared UI components
│
└── src/                          # Mobile app source
    ├── services/                 # Supabase data access layer
    ├── screens/                  # App screens
    ├── navigation/               # React Navigation setup
    ├── context/                  # Auth context
    ├── styles/                   # Theme and common styles
    └── utils/
        ├── config.js             # DEMO_MODE flag — set false for production
        ├── demoData.js           # Local mock data for demo mode
        └── constants.js
```

---

## Cost Summary

| Item | Cost | Type |
|---|---|---|
| Apple Developer Program | $99/year | Recurring |
| Google Play Developer | $25 | One-time |
| Supabase (Free tier) | $0/month | Recurring |
| Supabase (Pro, if needed) | $25/month | Recurring |
| Vercel (admin console, Hobby) | $0/month | Recurring |
| Expo EAS (30 builds/month) | $0/month | Recurring |

A typical parish will stay on free tiers indefinitely.

---

## Security Notes

- Never commit `supabase.config.js` or `admin-console/.env.local` with real credentials to a public repository — both are in `.gitignore`
- Row Level Security (RLS) is enabled on all database tables
- Contribution data is restricted to head-of-household members at both the app and database level
- The storage bucket is **private** — photos are served via signed URLs that expire after 24 hours
- The QB Web Connector password is stored as a Supabase secret, never in code
- The admin console requires an authenticated admin session for every API route

---

## License

Private and proprietary to St. Thomas Malankara Orthodox Church, Long Island, NY.
Version 1.0.0
