# St. Thomas App - Complete Setup Guide

This guide walks you through every step needed to get the St. Thomas Church Directory app up and running.

## Part 1: Development Environment Setup

### Step 1: Install Node.js and npm
1. Download Node.js 18+ from https://nodejs.org/
2. Install and verify:
   ```bash
   node --version  # Should show v18 or higher
   npm --version
   ```

### Step 2: Install Expo CLI
```bash
npm install -g expo-cli
```

### Step 3: Install Dependencies
Navigate to the project directory and run:
```bash
cd StThomasApp
npm install
```

This may take a few minutes to download all packages.

---

## Part 2: Firebase Setup

### Step 1: Create Firebase Project
1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Name it "St-Thomas-Directory"
4. Disable Google Analytics (optional)
5. Click "Create project"

### Step 2: Enable Authentication
1. In Firebase Console, click "Authentication" in left sidebar
2. Click "Get started"
3. Click "Email/Password" under Sign-in method
4. Enable "Email/Password"
5. Click "Save"

### Step 3: Create Firestore Database
1. Click "Firestore Database" in left sidebar
2. Click "Create database"
3. Select "Start in production mode"
4. Choose a location closest to your users
5. Click "Enable"

### Step 4: Set Up Firestore Security Rules
1. Go to Firestore > Rules tab
2. Replace all content with the rules from `firestore.rules` file
3. Click "Publish"

### Step 5: Create Storage Bucket
1. Click "Storage" in left sidebar
2. Click "Get started"
3. Click "Next" (use default security rules for now)
4. Choose same location as Firestore
5. Click "Done"

### Step 6: Set Up Storage Security Rules
1. Go to Storage > Rules tab
2. Replace all content with the rules from `storage.rules` file
3. Click "Publish"

### Step 7: Get Firebase Config
1. Click the gear icon ⚙️ next to "Project Overview"
2. Click "Project settings"
3. Scroll down to "Your apps"
4. Click the web icon `</>`
5. Register your app with nickname "St-Thomas-Web"
6. Copy the firebaseConfig object
7. Open `firebase.config.js` in your project
8. Replace the placeholder values with your config

Example:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyA...",
  authDomain: "st-thomas-directory.firebaseapp.com",
  projectId: "st-thomas-directory",
  storageBucket: "st-thomas-directory.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

---

## Part 3: Google Calendar Setup

### Step 1: Create Google Cloud Project
1. Go to https://console.cloud.google.com/
2. Click "Select a project" > "New Project"
3. Name it "St-Thomas-Calendar"
4. Click "Create"

### Step 2: Enable Google Calendar API
1. In the search bar, type "Calendar API"
2. Click "Google Calendar API"
3. Click "Enable"

### Step 3: Create API Key
1. Go to "Credentials" (left sidebar)
2. Click "Create Credentials" > "API key"
3. Copy the API key
4. Click "Restrict Key"
5. Under "API restrictions", select "Restrict key"
6. Check only "Google Calendar API"
7. Click "Save"

### Step 4: Make Church Calendar Public
1. Open Google Calendar (https://calendar.google.com)
2. Find your church calendar in "My calendars"
3. Click the three dots next to the calendar name
4. Click "Settings and sharing"
5. Scroll to "Access permissions for events"
6. Check "Make available to public"
7. Scroll to "Integrate calendar"
8. Copy the "Calendar ID" (looks like: abc123@group.calendar.google.com)

### Step 5: Configure in Firestore
1. Go back to Firebase Console > Firestore
2. Click "Start collection"
3. Collection ID: `appSettings`
4. Document ID: `config`
5. Add these fields:
   - `googleCalendarId` (string): Paste your Calendar ID
   - `googleApiKey` (string): Paste your Google API key
   - `churchName` (string): "St. Thomas Church"
   - `churchAddress` (string): Your church address
   - `contactEmail` (string): Your contact email
6. Click "Save"

---

## Part 4: Add Sample Data

### Step 1: Create a Test Family
1. In Firestore, click "Start collection" (if first time) or "Add collection"
2. Collection ID: `families`
3. Document ID: Click "Auto-ID"
4. Add these fields:
   - `familyName` (string): "Smith Family"
   - `membershipId` (string): "MEM001"
   - `address` (map):
     - `street` (string): "123 Main St"
     - `city` (string): "Springfield"
     - `state` (string): "IL"
     - `zipCode` (string): "62701"
   - `phoneNumber` (string): "(555) 123-4567"
   - `email` (string): "smith@example.com"
   - `photoUrl` (string): ""
   - `isActive` (boolean): true
   - `createdAt` (timestamp): Click "Set to current time"
   - `updatedAt` (timestamp): Click "Set to current time"
5. Click "Save"
6. Note the Document ID (you'll need it for the next step)

### Step 2: Create a Test Member
1. Click "Start collection" or "Add collection"
2. Collection ID: `members`
3. Document ID: Click "Auto-ID"
4. Add these fields:
   - `familyId` (string): Paste the family Document ID from Step 1
   - `userId` (string): Leave empty for now (will fill after creating user)
   - `firstName` (string): "John"
   - `lastName` (string): "Smith"
   - `email` (string): "john.smith@example.com"
   - `phoneNumber` (string): "(555) 123-4567"
   - `role` (string): "parent"
   - `photoUrl` (string): ""
   - `isActive` (boolean): true
   - `createdAt` (timestamp): Click "Set to current time"
   - `updatedAt` (timestamp): Click "Set to current time"
5. Click "Save"
6. Note this Document ID as well

### Step 3: Create Test User Account
1. Go to Authentication > Users tab
2. Click "Add user"
3. Email: john.smith@example.com
4. Password: TestPass123! (or your preferred password)
5. Click "Add user"
6. Copy the User UID shown in the table

### Step 4: Link User to Member
1. Go back to Firestore > members collection
2. Find the John Smith document you created
3. Click on it to edit
4. Update the `userId` field with the User UID you just copied
5. Click "Update"

### Step 5: Create User Role
1. In Firestore, click "Start collection" or "Add collection"
2. Collection ID: `userRoles`
3. Document ID: Paste the User UID (same one from Step 3)
4. Add these fields:
   - `role` (string): "admin"
   - `permissions` (map):
     - `canViewDirectory` (boolean): true
     - `canEditFamily` (boolean): true
     - `canManageAll` (boolean): true
5. Click "Save"

---

## Part 5: Add Placeholder Assets

### Option 1: Use Online Placeholders (Quick)
1. Go to https://placehold.co/1024x1024/png
2. Right-click > Save image as `icon.png` in `assets/` folder
3. Go to https://placehold.co/1242x2436/png
4. Right-click > Save image as `splash.png` in `assets/` folder

### Option 2: Create Custom Images (Recommended)
1. Use Canva, Photoshop, or any design tool
2. Create an app icon (1024x1024 px) with church logo
3. Save as `assets/icon.png`
4. Create a splash screen (1242x2436 px) with church name
5. Save as `assets/splash.png`

---

## Part 6: Test the App

### Step 1: Start Development Server
```bash
npm start
```

Wait for the QR code to appear in your terminal.

### Step 2: Test on Your Phone
1. Install "Expo Go" app from App Store (iOS) or Google Play (Android)
2. Open Expo Go
3. Scan the QR code shown in terminal
4. Wait for app to load

### Step 3: Test Login
1. Use the test account credentials:
   - Email: john.smith@example.com
   - Password: TestPass123! (or whatever you set)
2. You should see the main app with three tabs

### Step 4: Test Features
- **Directory Tab**: You should see "Smith Family"
- **Calendar Tab**: You should see your Google Calendar events
- **Profile Tab**: You should see John Smith's profile

---

## Part 7: Add Real Data

### Adding Families
1. Go to Firestore > families collection
2. Click "Add document"
3. Follow the same pattern as the test family
4. Add photos to Storage (optional):
   - Go to Storage
   - Create folder: `families/[FAMILY_DOC_ID]/`
   - Upload image as `photo.jpg`
   - Copy the download URL
   - Update family document's `photoUrl` field

### Adding Members
1. Go to Firestore > members collection
2. Click "Add document"
3. Link to family using `familyId`
4. Add photos to Storage (optional):
   - Create folder: `members/[MEMBER_DOC_ID]/`
   - Upload image as `photo.jpg`

### Creating User Accounts
1. Only create accounts for members who need app access
2. Go to Authentication > Users
3. Add user with their email
4. Update corresponding member document with `userId`
5. Create userRoles document (use "member" role for non-admins)

---

## Troubleshooting

### "Network request failed"
- Check your Firebase config in `firebase.config.js`
- Ensure your computer/phone has internet connection
- Verify Firebase services are enabled

### "Permission denied" errors
- Check that security rules are published in both Firestore and Storage
- Verify user is authenticated (check Authentication tab in Firebase)
- Ensure userRoles document exists for the user

### Calendar not showing events
- Verify Google Calendar is public
- Check that API key is valid and properly configured
- Ensure `appSettings/config` document exists in Firestore with correct fields
- Check calendar has actual events to display

### App won't start
- Run `npm install` again to ensure all dependencies are installed
- Delete `node_modules` folder and run `npm install` again
- Check for error messages in terminal
- Ensure Node.js version is 18 or higher

### Login not working
- Verify user exists in Firebase Authentication
- Check that email/password are correct
- Ensure Email/Password authentication is enabled in Firebase Console

---

## Next Steps

Once everything is working:
1. Add all your church families and members
2. Upload family photos
3. Create user accounts for members who need access
4. Test with a small group before full rollout
5. Consider building for production (see main README.md)

---

## Support

If you encounter issues not covered here:
1. Check the Firebase Console for detailed error messages
2. Look at the terminal logs where you ran `npm start`
3. Review the main README.md for additional information
4. Check that all setup steps were completed in order

## Estimated Setup Time

- Development environment: 15-30 minutes
- Firebase setup: 30-45 minutes
- Google Calendar setup: 15-20 minutes
- Adding sample data: 15-20 minutes
- Testing: 10-15 minutes

**Total: 1.5 - 2.5 hours**
