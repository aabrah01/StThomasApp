# Quick Start Guide

## Prerequisites Check
- [ ] Node.js 18+ installed
- [ ] npm installed
- [ ] Expo CLI installed globally (`npm install -g expo-cli`)

## Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure Firebase
# Edit firebase.config.js with your Firebase credentials

# 3. Start development server
npm start

# 4. Test on your device
# Scan QR code with Expo Go app (iOS/Android)
```

## Minimum Required Setup

Before the app will work, you MUST:

1. **Create Firebase Project**
   - Enable Authentication (Email/Password)
   - Create Firestore database
   - Create Storage bucket
   - Deploy security rules from `firestore.rules` and `storage.rules`
   - Update `firebase.config.js` with your config

2. **Add Google Calendar Config**
   - Enable Google Calendar API
   - Create API key
   - Add to Firestore: `appSettings/config` document with:
     - `googleCalendarId`
     - `googleApiKey`

3. **Create Test User**
   - Add user in Firebase Authentication
   - Create corresponding documents in:
     - `members` collection (with userId field)
     - `userRoles` collection (document ID = user's UID)

4. **Add Placeholder Assets** (for building)
   - `assets/icon.png` (1024x1024 px)
   - `assets/splash.png` (1242x2436 px)

## Test Credentials Template

After setup, you'll have:
- Email: [your-test-email@example.com]
- Password: [your-test-password]

## Common Commands

```bash
# Start development server
npm start

# Run on iOS simulator (Mac only)
npm run ios

# Run on Android emulator
npm run android

# Clear cache and restart
expo start -c
```

## First Login

1. App will show login screen
2. Enter your test user credentials
3. You should see three tabs:
   - Directory (list of families)
   - Calendar (Google Calendar events)
   - Profile (your user info)

## Troubleshooting

**App won't start:**
- Run `npm install` again
- Check Node.js version: `node --version` (should be 18+)

**Login fails:**
- Verify Firebase config in `firebase.config.js`
- Check user exists in Firebase Authentication
- Ensure Email/Password auth is enabled

**No data showing:**
- Create at least one family in Firestore `families` collection
- Create corresponding member in `members` collection
- Link member to family via `familyId` field

**Calendar empty:**
- Verify `appSettings/config` exists in Firestore
- Check Google Calendar is public
- Ensure calendar has events

## Next Steps

1. Read `SETUP_GUIDE.md` for detailed instructions
2. Review `README.md` for full documentation
3. Add real church data to Firestore
4. Create production builds with `eas build`

## Support Files

- `README.md` - Full documentation
- `SETUP_GUIDE.md` - Step-by-step setup instructions
- `firestore.rules` - Firestore security rules
- `storage.rules` - Storage security rules

## Project Structure

```
src/
├── navigation/      # App navigation
├── screens/         # All screens (auth, directory, calendar, profile)
├── components/      # Reusable UI components
├── services/        # Firebase & API services
├── context/         # Authentication context
├── styles/          # Theme and common styles
└── utils/           # Constants and helpers
```
