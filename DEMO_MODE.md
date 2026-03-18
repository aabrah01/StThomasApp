# Demo Mode - Test Without Firebase

Demo mode allows you to test the app immediately without setting up Firebase, Google Calendar, or any backend services. Perfect for quick testing and demonstrations!

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the App**
   ```bash
   npm start
   ```

3. **Open on Your Device**
   - Install "Expo Go" app from App Store (iOS) or Google Play (Android)
   - Scan the QR code shown in your terminal
   - Wait for the app to load

4. **Login with Demo Credentials**
   - Email: `demo@example.com`
   - Password: `demo123`

That's it! You're in!

## What You'll See

### Directory Tab
- 5 sample families (Johnson, Williams, Anderson, Martinez, Davis)
- Each family has contact information and members
- Search functionality works with sample data
- Click any family to see details

### Calendar Tab
- 6 sample events spread over the next 2 weeks
- Calendar view with marked dates
- Click dates to see events for that day
- Pull to refresh (returns same demo data)

### Profile Tab
- Demo user "John Johnson"
- Linked to Johnson Family
- Member role displayed
- Logout button (takes you back to login)

## Demo Data

The app uses mock data from `src/utils/demoData.js`:
- **5 families** with addresses and contact info
- **9 members** across the families
- **6 calendar events** (church services, Bible study, etc.)
- **1 demo user** (John Johnson)

## Features You Can Test

✅ User authentication (login/logout)
✅ Password reset flow (simulated)
✅ Browse church directory
✅ Search families by name
✅ View family details
✅ See family members with roles
✅ View calendar events
✅ Select dates to filter events
✅ Pull to refresh
✅ User profile page
✅ Navigation between tabs
✅ Error handling
✅ Loading states

## Switching to Real Firebase

When you're ready to connect to real Firebase:

1. **Open `src/utils/config.js`**
2. **Change this line:**
   ```javascript
   export const DEMO_MODE = false;  // Changed from true to false
   ```

3. **Configure Firebase:**
   - Follow instructions in `SETUP_GUIDE.md`
   - Update `firebase.config.js` with your credentials
   - Set up Firestore, Storage, and Authentication
   - Add Google Calendar API credentials

4. **Restart the app**
   ```bash
   npm start
   ```

The app will now connect to your real Firebase backend!

## Technical Details

### How Demo Mode Works

Demo mode is implemented in the service layer:
- **authService.js** - Uses mock authentication, no Firebase Auth
- **firestoreService.js** - Returns mock data instead of Firestore queries
- **calendarService.js** - Returns mock events instead of Google Calendar API

The configuration is controlled by a single flag in `src/utils/config.js`:
```javascript
export const DEMO_MODE = true;
```

### What's Mocked

When `DEMO_MODE = true`:
- ✅ User authentication (no real passwords checked)
- ✅ Family/member data (from local JSON)
- ✅ Calendar events (from local JSON)
- ✅ User roles and permissions
- ✅ Network delays (simulated for realism)

### What's Not Mocked

These still work normally in demo mode:
- Navigation and routing
- UI components and styling
- Image handling (falls back to initials)
- Search and filtering
- Local state management
- Pull to refresh
- Error boundaries

## Troubleshooting Demo Mode

### App won't start
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
npm start
```

### "Network error" on login
- Check that `DEMO_MODE = true` in `src/utils/config.js`
- Use exact demo credentials: `demo@example.com` / `demo123`

### No data showing after login
- Verify `src/utils/demoData.js` exists
- Check console for errors: press `j` in terminal after `npm start`

### Changes not appearing
- In Expo Go, shake device and select "Reload"
- Or press `r` in the terminal where `npm start` is running

## Customizing Demo Data

Want to test with your own data? Edit `src/utils/demoData.js`:

```javascript
export const demoFamilies = [
  {
    id: 'family1',
    familyName: 'Your Family Name',
    membershipId: 'MEM001',
    // ... add your test data
  },
  // ... add more families
];
```

Then restart the app to see your changes.

## Performance

Demo mode is actually faster than Firebase because:
- No network requests (instant responses)
- No authentication delays
- No image downloads
- All data is local

Perfect for:
- UI/UX testing
- Demonstrations
- Development without internet
- Client presentations

## Limitations

Demo mode cannot test:
- Real authentication security
- Firebase security rules
- Image uploads/downloads
- Multi-user scenarios
- Real-time data synchronization
- Push notifications
- Production performance

For these, you'll need to set up the real Firebase backend.

## Need Help?

- **Testing basics**: This file (you're reading it!)
- **Full setup**: See `SETUP_GUIDE.md`
- **Quick reference**: See `QUICK_START.md`
- **Complete docs**: See `README.md`

## Summary

Demo mode lets you:
- ✅ Test the app in under 5 minutes
- ✅ No Firebase account needed
- ✅ No backend setup required
- ✅ See all features working
- ✅ Perfect for demonstrations

When ready for production:
- Change `DEMO_MODE` to `false`
- Follow `SETUP_GUIDE.md`
- Connect to real Firebase
