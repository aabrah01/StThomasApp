import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../../firebase.config';
import { DEMO_MODE, DEMO_CREDENTIALS } from '../utils/config';
import { demoUser } from '../utils/demoData';

class AuthService {
  constructor() {
    this.demoAuthState = null;
    this.demoAuthListeners = [];
  }

  async signIn(email, password) {
    // Demo mode: Use mock authentication
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

      if (email === DEMO_CREDENTIALS.email && password === DEMO_CREDENTIALS.password) {
        this.demoAuthState = demoUser;
        this.notifyDemoAuthListeners(demoUser);
        return { user: demoUser, error: null };
      } else {
        return { user: null, error: 'Invalid email or password.' };
      }
    }

    // Real Firebase authentication
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { user: userCredential.user, error: null };
    } catch (error) {
      return { user: null, error: this.getErrorMessage(error) };
    }
  }

  async signOut() {
    // Demo mode: Clear mock auth state
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
      this.demoAuthState = null;
      this.notifyDemoAuthListeners(null);
      return { error: null };
    }

    // Real Firebase sign out
    try {
      await signOut(auth);
      return { error: null };
    } catch (error) {
      return { error: this.getErrorMessage(error) };
    }
  }

  async resetPassword(email) {
    // Demo mode: Simulate password reset
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
      return { error: null };
    }

    // Real Firebase password reset
    try {
      await sendPasswordResetEmail(auth, email);
      return { error: null };
    } catch (error) {
      return { error: this.getErrorMessage(error) };
    }
  }

  onAuthStateChange(callback) {
    // Demo mode: Use custom auth state management
    if (DEMO_MODE) {
      this.demoAuthListeners.push(callback);
      // Immediately call with current state
      setTimeout(() => callback(this.demoAuthState), 0);
      // Return unsubscribe function
      return () => {
        this.demoAuthListeners = this.demoAuthListeners.filter(cb => cb !== callback);
      };
    }

    // Real Firebase auth state listener
    return onAuthStateChanged(auth, callback);
  }

  getCurrentUser() {
    // Demo mode: Return mock user
    if (DEMO_MODE) {
      return this.demoAuthState;
    }

    // Real Firebase current user
    return auth.currentUser;
  }

  notifyDemoAuthListeners(user) {
    this.demoAuthListeners.forEach(callback => callback(user));
  }

  getErrorMessage(error) {
    switch (error.code) {
      case 'auth/invalid-email':
        return 'Invalid email address.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/user-not-found':
        return 'No account found with this email.';
      case 'auth/wrong-password':
        return 'Incorrect password.';
      case 'auth/invalid-credential':
        return 'Invalid credentials. Please check your email and password.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection.';
      default:
        return 'An error occurred. Please try again.';
    }
  }
}

export default new AuthService();
