import { supabase } from '../../supabase.config';
import { DEMO_MODE, DEMO_CREDENTIALS } from '../utils/config';
import { demoUser } from '../utils/demoData';

class AuthService {
  constructor() {
    this.demoAuthState = null;
    this.demoAuthListeners = [];
  }

  async signIn(email, password) {
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (email === DEMO_CREDENTIALS.email && password === DEMO_CREDENTIALS.password) {
        this.demoAuthState = demoUser;
        this.notifyDemoAuthListeners(demoUser);
        return { user: demoUser, error: null };
      }
      return { user: null, error: 'Invalid email or password.' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { user: null, error: this.getErrorMessage(error) };
    return { user: data.user, error: null };
  }

  async signOut() {
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 300));
      this.demoAuthState = null;
      this.notifyDemoAuthListeners(null);
      return { error: null };
    }

    const { error } = await supabase.auth.signOut();
    return { error: error?.message || null };
  }

  async resetPassword(email) {
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return { error: null };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error?.message || null };
  }

  onAuthStateChange(callback) {
    if (DEMO_MODE) {
      this.demoAuthListeners.push(callback);
      setTimeout(() => callback(this.demoAuthState), 0);
      return () => {
        this.demoAuthListeners = this.demoAuthListeners.filter(cb => cb !== callback);
      };
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }

  getCurrentUser() {
    if (DEMO_MODE) return this.demoAuthState;
    return supabase.auth.getUser();
  }

  notifyDemoAuthListeners(user) {
    this.demoAuthListeners.forEach(callback => callback(user));
  }

  getErrorMessage(error) {
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
      return 'Invalid email or password.';
    }
    if (msg.includes('email not confirmed')) return 'Please confirm your email address.';
    if (msg.includes('too many requests')) return 'Too many failed attempts. Please try again later.';
    if (msg.includes('network')) return 'Network error. Please check your connection.';
    return 'An error occurred. Please try again.';
  }
}

export default new AuthService();
