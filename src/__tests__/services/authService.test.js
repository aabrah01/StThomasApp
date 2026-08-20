/**
 * Tests for AuthService in DEMO_MODE = true.
 * These run entirely against the in-memory demo state — no real Supabase calls.
 */

// Force DEMO_MODE on before any modules are imported.
// Shape must match src/utils/config.js — authService destructures all of these.
jest.mock('../../utils/config', () => ({
  DEMO_MODE: true,
  DEMO_CREDENTIALS: { email: 'demo@example.com', pin: '123456' },
  DEMO_EMAIL: 'demo@stthomasli.org',
  DEMO_PIN: '123456',
  setDemoSession: jest.fn(),
  isDemoSession: () => true,
}));

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PIN = '123456';

// Re-import each test to get a fresh AuthService instance
let authService;
beforeEach(() => {
  jest.resetModules();
  authService = require('../../services/authService').default;
});

// Login is two steps: request a PIN, then verify it.
const signInDemo = () => authService.verifyPin(DEMO_EMAIL, DEMO_PIN);

describe('AuthService — demo mode', () => {
  describe('requestPin', () => {
    it('returns no error for the demo email', async () => {
      const result = await authService.requestPin(DEMO_EMAIL);
      expect(result.error).toBeNull();
    });

    it('returns an error for an email that is not registered', async () => {
      const result = await authService.requestPin('wrong@example.com');
      expect(result.error).toBeTruthy();
    });
  });

  describe('verifyPin', () => {
    it('returns a user on the correct PIN', async () => {
      const result = await signInDemo();
      expect(result.error).toBeNull();
      expect(result.user).toBeTruthy();
    });

    it('returns an error on an incorrect PIN', async () => {
      const result = await authService.verifyPin(DEMO_EMAIL, '000000');
      expect(result.user).toBeNull();
      expect(result.error).toBeTruthy();
    });
  });

  describe('signOut', () => {
    it('clears auth state after sign in', async () => {
      await signInDemo();
      expect(authService.getCurrentUser()).toBeTruthy();

      const result = await authService.signOut();
      expect(result.error).toBeNull();
      expect(authService.getCurrentUser()).toBeNull();
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
      await signInDemo();

      expect(received.length).toBeGreaterThanOrEqual(2);
      expect(received[received.length - 1]).toBeTruthy(); // last callback has user
      unsubscribe();
    });

    it('notifies listeners when user signs out', async () => {
      await signInDemo();
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
      await signInDemo();

      expect(received.length).toBe(countBefore); // no new callbacks after unsubscribe
    });
  });

  describe('getCurrentUser', () => {
    it('returns null before sign-in', () => {
      expect(authService.getCurrentUser()).toBeNull();
    });

    it('returns user after sign-in', async () => {
      await signInDemo();
      expect(authService.getCurrentUser()).toBeTruthy();
    });
  });
});
