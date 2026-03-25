# St. Thomas App — Complete Setup Guide

This guide walks you through every step needed to get the St. Thomas Church Directory app connected to a real backend.

## Part 1: Development Environment

### Step 1: Install Node.js and npm
1. Download Node.js 18+ from https://nodejs.org/
2. Verify:
```bash
node --version   # Should show v18 or higher
npm --version
```

### Step 2: Install Expo CLI
```bash
npm install -g expo-cli
```

### Step 3: Install Dependencies
```bash
cd StThomasApp
npm install
```

---

## Part 2: Supabase Setup

### Step 1: Create a Supabase Project
1. Go to https://supabase.com and sign in
2. Click **New project**
3. Name it `st-thomas-directory`
4. Choose a region closest to Long Island, NY (e.g. US East)
5. Set a strong database password and save it somewhere safe
6. Click **Create new project** — takes about 2 minutes

### Step 2: Run the Database Schema
1. In the Supabase dashboard, go to **SQL Editor → New query**
2. Open `supabase/schema.sql` from this project
3. Paste the entire contents into the editor
4. Click **Run**

This creates all tables, Row Level Security policies, and indexes.

### Step 3: Create the Storage Bucket
1. Go to **Storage → New bucket**
2. Name: `family-photos`
3. Toggle **Public bucket** ON
4. Click **Save**

### Step 4: Get Your API Credentials
1. Go to **Project Settings → API**
2. Copy:
   - **Project URL** (e.g. `https://abcxyz.supabase.co`)
   - **anon public** key
3. Open `supabase.config.js` in this project and replace the placeholders:

```javascript
const SUPABASE_URL = 'https://your-project-ref.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

### Step 5: Turn Off Demo Mode
Open `src/utils/config.js` and change:
```javascript
export const DEMO_MODE = false;
```

---

## Part 3: Add Parish Data

### Adding Families
Go to **Table Editor → families** and insert rows. Required fields:
- `family_name` — e.g. "Smith Family"
- `membership_id` — e.g. "MEM001"
- `is_active` — true

### Adding Members
Go to **Table Editor → members** and insert rows. Required fields:
- `family_id` — UUID of the family from the families table
- `first_name`, `last_name`
- `is_active` — true
- `is_head_of_household` — set `true` for one member per family (enables contribution viewing)

### Creating User Accounts
1. Go to **Authentication → Users → Invite user**
2. Enter the member's email — they'll receive a sign-up link
3. After they sign up, copy their **User UID** from the Users table
4. Update the corresponding `members` row: set `user_id` to their UID
5. Insert a row in `user_roles`: `user_id` = their UID, `role` = `'member'` (or `'admin'`)

### Adding Events
Go to **Table Editor → events**. Fields:
- `title`, `description`, `location`
- `start_date`, `end_date` — ISO 8601 format (e.g. `2026-04-05T09:30:00`)
- `is_all_day` — boolean

### Adding Documents
Go to **Table Editor → documents**. Fields:
- `title`, `description`, `type` (`tax-letter`, `annual-report`, `receipt`)
- `year` — integer (e.g. `2026`) — only current year documents show in the app
- `url` — public URL to the PDF

---

## Part 4: QuickBooks Desktop Contribution Sync

Contributions are synced nightly from QuickBooks Desktop via the QB Web Connector.

### Step 1: Deploy the Edge Function
```bash
# Install Supabase CLI if needed
npm install -g supabase

# Login
npx supabase login

# Link to your project
npx supabase link --project-ref your-project-ref

# Deploy
npx supabase functions deploy qbwc-sync
```

### Step 2: Set Secrets
```bash
npx supabase secrets set QBWC_USERNAME=qbwc
npx supabase secrets set QBWC_PASSWORD=choose-a-strong-password
```

### Step 3: Configure QB Web Connector
1. On the Windows machine running QuickBooks Desktop, install **QuickBooks Web Connector** (free from Intuit)
2. Open `supabase/qbwc-config.qwc` in a text editor
3. Replace `YOUR_PROJECT_REF` with your Supabase project reference
4. Save and open the `.qwc` file in QB Web Connector
5. Enter the `QBWC_PASSWORD` you set above when prompted
6. Set schedule: **Run Every 1440 minutes** (nightly)
7. Click **Update Selected** to run a manual sync at any time

### How Contributions Map from QB
| QuickBooks | Supabase `contributions` |
|---|---|
| Customer (FullName) | Matched to `families.family_name` |
| TxnDate | `date` |
| Line Item Amount | `amount` |
| Line Item Product/Service | `category` (imported as-is) |
| Memo | `description` |

---

## Part 5: Test the App

### Step 1: Start Development Server
```bash
npm start
```

### Step 2: Test on Your Phone
1. Install **Expo Go** from App Store (iOS) or Google Play (Android)
2. Scan the QR code shown in terminal

### Step 3: Verify Each Feature
- **Directory** — families and members should load
- **Calendar** — events should appear with dots on dates
- **Profile** — your name, family, and (if head-of-household) giving summary

---

## Troubleshooting

### "Network request failed" / no data
- Check `supabase.config.js` has the correct URL and anon key
- Confirm `DEMO_MODE = false` in `src/utils/config.js`
- Verify RLS policies are in place (run `supabase/schema.sql` if not)

### Login not working
- Confirm the user exists in **Authentication → Users**
- Confirm `user_roles` row exists for that user
- Check that Email/Password is enabled in **Authentication → Providers**

### Contribution data not showing
- Confirm the member has `is_head_of_household = true`
- Run a manual sync in QB Web Connector and check Edge Function logs
- Verify `family_name` in Supabase matches QB customer name

### Calendar events not showing
- Check that `start_date` is in ISO format: `YYYY-MM-DDTHH:MM:SS`
- Confirm the event's date matches what you're selecting on the calendar

---

## Estimated Setup Time

- Development environment: 15–30 minutes
- Supabase setup + schema: 20–30 minutes
- Adding parish data: 30–60 minutes
- QB Web Connector setup: 20–30 minutes
- Testing: 15–20 minutes

**Total: ~2 hours**
