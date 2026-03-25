# 🚀 St. Thomas Church Directory App - START HERE

Welcome! This is a complete React Native mobile app for church directory management.

## 📱 What You Can Do Right Now (5 Minutes)

### Test Without Any Setup - Demo Mode ✨

The app comes with **demo mode enabled** so you can test immediately without Firebase!

```bash
# 1. Install dependencies (one-time, takes 2-3 minutes)
npm install

# 2. Start the app
npm start

# 3. Scan QR code with Expo Go app on your phone
#    (Download Expo Go from App Store or Google Play)

# 4. Login with demo credentials:
#    Email: demo@example.com
#    Password: demo123
```

**That's it!** You'll see a working church directory with:
- 5 sample families
- Calendar with events
- Full navigation
- All features working

📖 **Full demo mode guide:** See `DEMO_MODE.md`

---

## 🏗️ When Ready to Use Real Data

Follow these guides in order:

### 1. Quick Setup (30 min)
- Read: `QUICK_START.md`
- Install Firebase
- Configure basics

### 2. Complete Setup (2-3 hours)
- Read: `SETUP_GUIDE.md`
- Detailed step-by-step
- Add real church data

### 3. Full Documentation
- Read: `README.md`
- All features explained
- Deployment instructions

---

## 🎯 What's Included

### ✅ Complete Features
- User authentication (email/password)
- Church directory with photos
- Family and member management
- Google Calendar integration
- Search and filtering
- Offline support
- User profiles
- Role-based access (admin/member)

### ✅ Professional Code
- React Native + Expo
- Firebase backend
- Clean architecture
- Responsive design
- Error handling
- Loading states

### ✅ Ready for Production
- Security rules included
- Build configuration
- App store ready
- Over-the-air updates

---

## 📂 Project Structure

```
StThomasApp/
├── START_HERE.md          ← You are here!
├── DEMO_MODE.md           ← Test without Firebase
├── QUICK_START.md         ← Fast setup guide
├── SETUP_GUIDE.md         ← Detailed setup
├── README.md              ← Full documentation
│
├── App.js                 ← Main entry point
├── package.json           ← Dependencies
├── app.json               ← Expo config
├── firebase.config.js     ← Firebase setup
│
└── src/
    ├── screens/           ← All app screens
    ├── components/        ← Reusable UI components
    ├── services/          ← Backend logic
    ├── navigation/        ← App navigation
    ├── context/           ← State management
    ├── styles/            ← Theme & styles
    └── utils/             ← Helpers & constants
```

---

## ⚡ Quick Commands

```bash
# Install dependencies (first time only)
npm install

# Start development server
npm start

# Run on iOS (Mac only, requires Xcode)
npm run ios

# Run on Android (requires Android Studio)
npm run android

# Clear cache and restart
npx expo start -c
```

---

## 🔄 Toggle Between Demo and Real Firebase

### Using Demo Mode (Default)
File: `src/utils/config.js`
```javascript
export const DEMO_MODE = true;  // Demo mode ON
```

### Using Real Firebase
```javascript
export const DEMO_MODE = false;  // Demo mode OFF
```

Then configure `firebase.config.js` with your credentials.

---

## 🆘 Troubleshooting

### App won't install dependencies
```bash
# Make sure you have Node.js 18+
node --version

# If old version, download from: https://nodejs.org/
```

### App won't start
```bash
# Clear everything and reinstall
rm -rf node_modules
npm install
npm start
```

### Login doesn't work (Demo Mode)
- Use exact credentials: `demo@example.com` / `demo123`
- Check that `DEMO_MODE = true` in `src/utils/config.js`

### Expo Go can't connect
- Make sure phone and computer are on same WiFi
- Try restarting Expo with: `npm start`
- Scan QR code again

---

## 💡 What to Read Next

Choose your path:

### Path 1: Quick Demo (5 min)
1. Run `npm install && npm start`
2. Read `DEMO_MODE.md` while waiting
3. Test the app!

### Path 2: Quick Setup (30 min)
1. Read `QUICK_START.md`
2. Set up Firebase basics
3. Connect your data

### Path 3: Full Setup (2-3 hours)
1. Read `SETUP_GUIDE.md`
2. Complete Firebase setup
3. Add all church data
4. Configure Google Calendar
5. Test thoroughly

### Path 4: Deep Dive (1 day)
1. Read `README.md`
2. Understand all features
3. Customize for your needs
4. Deploy to app stores

---

## 📞 Support

**Documentation Files:**
- `DEMO_MODE.md` - Test without backend
- `QUICK_START.md` - Fast setup
- `SETUP_GUIDE.md` - Complete setup
- `README.md` - Full documentation

**File Issues:**
- Check console logs in terminal
- Review error messages in Expo Go
- Verify all setup steps completed

---

## 🎉 You're All Set!

The hardest part is done - the app is built! Now just:

1. **Test it** (5 min with demo mode)
2. **Configure it** (30 min with Firebase)
3. **Customize it** (add your church data)
4. **Deploy it** (submit to app stores)

**Let's get started!** 👇

```bash
npm install && npm start
```

---

## 📋 Checklist

- [ ] Node.js 18+ installed
- [ ] Ran `npm install`
- [ ] App starts with `npm start`
- [ ] Tested login with demo credentials
- [ ] Explored all three tabs
- [ ] Ready to set up Firebase (or staying in demo)

**Next:** Open `DEMO_MODE.md` to learn more about testing without Firebase.
