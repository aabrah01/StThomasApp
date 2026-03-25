# St. Thomas Church Directory Mobile App

A cross-platform mobile application (iOS + Android) for managing church directory with integrated Google Calendar for events.

## Features

- **Church Directory**: Browse families with photos, addresses, and contact information
- **Member Management**: View family members with roles and contact details
- **Google Calendar Integration**: View church events in a calendar view
- **User Authentication**: Secure email/password login via Firebase
- **Offline Support**: Cached data for offline viewing
- **Search**: Find families quickly by name
- **Role-Based Access**: Admin and member roles with appropriate permissions

## Technology Stack

- **Framework**: React Native with Expo (managed workflow)
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **Calendar**: Google Calendar API
- **Navigation**: React Navigation (Stack + Bottom Tabs)
- **Language**: JavaScript

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

### 2. Configure Firebase

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication (Email/Password method)
3. Create a Firestore database
4. Create a Storage bucket
5. Get your Firebase configuration from Project Settings
6. Update `firebase.config.js` with your Firebase credentials:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. Set Up Firestore Security Rules

1. Go to Firebase Console > Firestore > Rules
2. Copy the contents of `firestore.rules` and paste into the Firebase rules editor
3. Publish the rules

### 4. Set Up Storage Security Rules

1. Go to Firebase Console > Storage > Rules
2. Copy the contents of `storage.rules` and paste into the Firebase rules editor
3. Publish the rules

### 5. Configure Google Calendar

1. Create a Google Cloud Project
2. Enable Google Calendar API
3. Create an API key (restrict to Calendar API)
4. Make your church Google Calendar public (read-only)
5. Add the following document to Firestore:
   - Collection: `appSettings`
   - Document ID: `config`
   - Fields:
     ```
     {
       "googleCalendarId": "your-calendar-id@group.calendar.google.com",
       "googleApiKey": "YOUR_GOOGLE_API_KEY",
       "churchName": "St. Thomas Church",
       "churchAddress": "123 Main St, City, ST 12345",
       "contactEmail": "info@stthomas.org"
     }
     ```

### 6. Create Initial Data

#### Firestore Collections Structure

**families** collection:
```json
{
  "familyName": "Smith Family",
  "membershipId": "MEM001",
  "address": {
    "street": "123 Main St",
    "city": "Springfield",
    "state": "IL",
    "zipCode": "62701"
  },
  "phoneNumber": "(555) 123-4567",
  "email": "smith@example.com",
  "photoUrl": "",
  "isActive": true,
  "createdAt": "Firestore Timestamp",
  "updatedAt": "Firestore Timestamp"
}
```

**members** collection:
```json
{
  "familyId": "FAMILY_DOCUMENT_ID",
  "userId": "FIREBASE_AUTH_UID",
  "firstName": "John",
  "lastName": "Smith",
  "email": "john.smith@example.com",
  "phoneNumber": "(555) 123-4567",
  "role": "parent",
  "photoUrl": "",
  "isActive": true,
  "createdAt": "Firestore Timestamp",
  "updatedAt": "Firestore Timestamp"
}
```

**userRoles** collection:
```json
{
  "role": "admin",
  "permissions": {
    "canViewDirectory": true,
    "canEditFamily": true,
    "canManageAll": true
  }
}
```
Note: Document ID should match the Firebase Auth UID

### 7. Create User Accounts

1. Go to Firebase Console > Authentication > Users
2. Add users with email/password
3. Link each user to a member document by setting the `userId` field in the `members` collection
4. Create a `userRoles` document for each user (use their Auth UID as document ID)

### 8. Add Placeholder Images

Create placeholder images for the app:
- `assets/icon.png` - App icon (1024x1024 px)
- `assets/splash.png` - Splash screen (1242x2436 px for iPhone X)

You can use free tools like [Canva](https://canva.com) or generate placeholders at [PlaceHold.it](https://placehold.it).

## Running the App

### Development Mode

```bash
# Start Expo development server
npm start

# Run on iOS Simulator (Mac only)
npm run ios

# Run on Android Emulator
npm run android

# Scan QR code with Expo Go app (iOS/Android)
```

### Testing on Physical Device

1. Install Expo Go from App Store (iOS) or Google Play (Android)
2. Run `npm start`
3. Scan the QR code with your phone's camera (iOS) or Expo Go app (Android)

## Project Structure

```
StThomasApp/
├── App.js                       # Main app entry point
├── firebase.config.js           # Firebase initialization
├── app.json                     # Expo configuration
├── package.json                 # Dependencies
│
├── src/
│   ├── navigation/
│   │   └── AppNavigator.js      # Navigation structure
│   │
│   ├── screens/                 # All screen components
│   │   ├── auth/
│   │   ├── directory/
│   │   ├── calendar/
│   │   └── profile/
│   │
│   ├── components/              # Reusable UI components
│   │   ├── common/
│   │   ├── directory/
│   │   └── calendar/
│   │
│   ├── services/                # Business logic & API calls
│   │   ├── authService.js
│   │   ├── firestoreService.js
│   │   ├── storageService.js
│   │   └── calendarService.js
│   │
│   ├── context/
│   │   └── AuthContext.js       # Authentication state
│   │
│   ├── styles/                  # Theme and common styles
│   │   ├── theme.js
│   │   └── commonStyles.js
│   │
│   └── utils/
│       └── constants.js         # App constants
│
└── assets/                      # Images and static files
```

## Building for Production

### Using Expo EAS Build

1. Install EAS CLI:
```bash
npm install -g eas-cli
```

2. Configure EAS:
```bash
eas build:configure
```

3. Build for iOS:
```bash
eas build --platform ios
```

4. Build for Android:
```bash
eas build --platform android
```

5. Submit to App Stores:
```bash
eas submit --platform ios
eas submit --platform android
```

## Over-the-Air Updates

For JavaScript/asset changes (no native code changes):

```bash
eas update --branch production
```

## Common Issues

### Firebase Connection Issues
- Ensure your Firebase config is correct in `firebase.config.js`
- Check that Authentication, Firestore, and Storage are enabled in Firebase Console
- Verify your security rules are published

### Calendar Not Loading
- Verify Google Calendar API is enabled in Google Cloud Console
- Check that your API key is valid and properly restricted
- Ensure the calendar is set to public and the ID is correct in Firestore

### Authentication Errors
- Make sure Email/Password authentication is enabled in Firebase Console
- Verify user accounts are created in Firebase Authentication
- Check that userRoles documents exist for each user

## Cost Breakdown

### One-Time Costs
- Apple Developer Account: $99/year
- Google Play Developer Account: $25 one-time

### Monthly Costs
- Firebase: Free tier (Spark Plan) likely sufficient for small churches
  - If exceeded: Blaze plan (pay-as-you-go) ~$25/month
- Expo EAS: Free tier includes 30 builds/month

## Security Best Practices

1. Never commit `firebase.config.js` with real credentials to public repos
2. Keep Firebase security rules strict (only authenticated users can read)
3. Implement admin-only write permissions in Firestore rules
4. Use environment variables for sensitive data in production
5. Regularly review Firebase Console for unusual activity
6. Enable App Check for additional security (optional)

## Future Enhancements

- Push notifications for new events
- In-app messaging between members
- Prayer request submission
- Giving/donation integration
- Event RSVP functionality
- Admin web portal for easier data management
- Photo galleries for church events
- Sermon audio/video streaming

## Support

For issues or questions:
1. Check Firebase Console for errors
2. Review Expo logs: `expo start` then press `j` for logs
3. Check network connectivity
4. Verify all setup steps were completed

## License

This project is private and proprietary to St. Thomas Church.

## Version

Current Version: 1.0.0
