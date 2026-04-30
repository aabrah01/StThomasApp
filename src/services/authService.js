import { supabase } from '../../supabase.config';
import { DEMO_MODE, DEMO_CREDENTIALS } from '../utils/config';
import { demoUser } from '../utils/demoData';

class AuthService {
  constructor() {
    this.demoAuthState = null;
    this.demoAuthListeners = [];
  }

  async requestPin(email) {
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 600));
      if (email === DEMO_CREDENTIALS.email) {
        return { error: null };
      }
      return { error: 'This email is not registered with our parish. Please visit the church office to be added.' };
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    try {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/request-login-pin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ email }),
        }
      );

      if (!res.ok) {
        if (res.status === 404) {
          return { error: 'This email is not registered with our parish. Please visit the church office to be added.' };
        }
        return { error: 'Unable to send sign-in code. Please try again.' };
      }

      return { error: null };
    } catch {
      return { error: 'Network error. Please check your connection.' };
    }
  }

  async verifyPin(email, token) {
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 600));
      if (token === DEMO_CREDENTIALS.pin) {
        this.demoAuthState = demoUser;
        this.notifyDemoAuthListeners(demoUser);
        return { user: demoUser, error: null };
      }
      return { user: null, error: 'Incorrect code. Please check your email and try again.' };
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error) return { user: null, error: this.getOtpErrorMessage(error) };
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

  onAuthStateChange(callback) {
    if (DEMO_MODE) {
      this.demoAuthListeners.push(callback);
      setTimeout(() => callback(this.demoAuthState), 0);
      return () => {
        this.demoAuthListeners = this.demoAuthListeners.filter(cb => cb !== callback);
      };
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESH_FAILED') {
        // Stale/invalid refresh token — Supabase already cleared storage; propagate sign-out
        supabase.auth.signOut().finally(() => callback(null));
        return;
      }
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

  getOtpErrorMessage(error) {
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('token has expired') || msg.includes('otp expired') || msg.includes('expired')) {
      return 'Your code has expired. Please request a new one.';
    }
    if (msg.includes('invalid') || msg.includes('incorrect') || msg.includes('token')) {
      return 'Incorrect code. Please check your email and try again.';
    }
    if (msg.includes('too many') || msg.includes('rate')) {
      return 'Too many attempts. Please request a new code.';
    }
    if (msg.includes('network')) return 'Network error. Please check your connection.';
    return 'Verification failed. Please try again.';
  }
}

export default new AuthService();
