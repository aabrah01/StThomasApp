/**
 * Tests for AuthService in DEMO_MODE = true.
 * These run entirely against the in-memory demo state — no real Supabase calls.
 */

// Force DEMO_MODE on before any modules are imported
jest.mock('../../utils/config', () => ({
  DEMO_MODE: true,
  DEMO_CREDENTIALS: { email: 'demo@example.com', password: 'demo123' },
}));

// Re-import each test to get a fresh AuthService instance
let authService;
beforeEach(() => {
  jest.resetModules();
  jest.mock('../../utils/config', () => ({
    DEMO_MODE: true,
    DEMO_CREDENTIALS: { email: 'demo@example.com', password: 'demo123' },
  }));
  authService = require('../../services/authService').default;
});

describe('AuthService — demo mode', () => {
  describe('signIn', () => {
    it('returns a user on valid demo credentials', async () => {
      const result = await authService.signIn('demo@example.com', 'demo123');
      expect(result.error).toBeNull();
      expect(result.user).toBeTruthy();
    });

    it('returns an error on wrong email', async () => {
      const result = await authService.signIn('wrong@example.com', 'demo123');
      expect(result.user).toBeNull();
      expect(result.error).toBeTruthy();
    });

    it('returns an error on wrong password', async () => {
      const result = await authService.signIn('demo@example.com', 'wrongpassword');
      expect(result.user).toBeNull();
      expect(result.error).toBeTruthy();
    });
  });

  describe('signOut', () => {
    it('clears auth state after sign in', async () => {
      await authService.signIn('demo@example.com', 'demo123');
      expect(authService.getCurrentUser()).toBeTruthy();

      const result = await authService.signOut();
      expect(result.error).toBeNull();
      expect(authService.getCurrentUser()).toBeNull();
    });
  });

  describe('resetPassword', () => {
    it('always returns no error in demo mode', async () => {
      const result = await authService.resetPassword('any@example.com');
      expect(result.error).toBeNull();
    });
  });

  describe('onAuthStateChange', () => {
    it('calls callback immediately with current auth state (null before sign-in)', (done) => {
      const unsubscribe = authService.onAuthStateChange((user) => {
        expect(user).toBeNull();
        unsubscribe();
        done();
      });
    });

    it('notifies listeners when user signs in', async () => {
      const received = [];
      const unsubscribe = authService.onAuthStateChange((user) => received.push(user));

      // Wait for immediate null callback
      await new Promise(resolve => setTimeout(resolve, 10));
      await authService.signIn('demo@example.com', 'demo123');

      expect(received.length).toBeGreaterThanOrEqual(2);
      expect(received[received.length - 1]).toBeTruthy(); // last callback has user
      unsubscribe();
    });

    it('notifies listeners when user signs out', async () => {
      await authService.signIn('demo@example.com', 'demo123');
      const received = [];
      const unsubscribe = authService.onAuthStateChange((user) => received.push(user));

      await new Promise(resolve => setTimeout(resolve, 10));
      await authService.signOut();

      const lastValue = received[received.length - 1];
      expect(lastValue).toBeNull();
      unsubscribe();
    });

    it('returns an unsubscribe function that stops callbacks', async () => {
      const received = [];
      const unsubscribe = authService.onAuthStateChange((user) => received.push(user));
      await new Promise(resolve => setTimeout(resolve, 10));

      const countBefore = received.length;
      unsubscribe();
      await authService.signIn('demo@example.com', 'demo123');

      expect(received.length).toBe(countBefore); // no new callbacks after unsubscribe
    });
  });

  describe('getCurrentUser', () => {
    it('returns null before sign-in', () => {
      expect(authService.getCurrentUser()).toBeNull();
    });

    it('returns user after sign-in', async () => {
      await authService.signIn('demo@example.com', 'demo123');
      expect(authService.getCurrentUser()).toBeTruthy();
    });
  });
});
