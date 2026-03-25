import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// TODO: Replace with your Firebase project configuration
// Get this from Firebase Console > Project Settings > General > Your apps
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Check if we're in demo mode - if so, we don't need real Firebase config
// This prevents errors when testing without Firebase setup
let app, auth, db, storage;

try {
  // Only initialize Firebase if we have real config
  // (In demo mode, these won't be used anyway)
  if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } else {
    // Placeholder exports for demo mode
    app = null;
    auth = null;
    db = null;
    storage = null;
  }
} catch (error) {
  console.log('Firebase initialization skipped (demo mode or config not set)');
  app = null;
  auth = null;
  db = null;
  storage = null;
}

export { auth, db, storage };
export default app;
