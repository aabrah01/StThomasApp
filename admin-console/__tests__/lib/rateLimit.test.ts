import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

// The rateLimit module holds a module-level Map. Reset between tests by re-importing
// or by advancing fake timers past the window to expire entries.

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('checkRateLimit', () => {
  it('allows requests up to the max', () => {
    const key = `test-allow-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5, 60_000)).toBe(true);
    }
  });

  it('blocks the request after max is reached', () => {
    const key = `test-block-${Date.now()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60_000);
    expect(checkRateLimit(key, 3, 60_000)).toBe(false);
  });

  it('resets the counter after the window expires', () => {
    const key = `test-reset-${Date.now()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60_000);
    expect(checkRateLimit(key, 3, 60_000)).toBe(false);

    // Advance time past the window
    jest.advanceTimersByTime(60_001);
    expect(checkRateLimit(key, 3, 60_000)).toBe(true);
  });

  it('first request in a new window counts as 1', () => {
    const key = `test-first-${Date.now()}`;
    expect(checkRateLimit(key, 1, 60_000)).toBe(true);
    expect(checkRateLimit(key, 1, 60_000)).toBe(false);

    jest.advanceTimersByTime(60_001);
    expect(checkRateLimit(key, 1, 60_000)).toBe(true);
  });

  it('different keys have independent counters', () => {
    const keyA = `test-keyA-${Date.now()}`;
    const keyB = `test-keyB-${Date.now()}`;

    for (let i = 0; i < 2; i++) checkRateLimit(keyA, 2, 60_000);
    expect(checkRateLimit(keyA, 2, 60_000)).toBe(false);
    expect(checkRateLimit(keyB, 2, 60_000)).toBe(true);
  });

  it('uses defaults of max=5 and windowMs=60000', () => {
    const key = `test-defaults-${Date.now()}`;
    for (let i = 0; i < 5; i++) expect(checkRateLimit(key)).toBe(true);
    expect(checkRateLimit(key)).toBe(false);
  });
});

describe('getClientIp', () => {
  it('extracts IP from x-forwarded-for (single IP)', () => {
    const req = new Request('http://localhost/', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('extracts the first IP from x-forwarded-for chain', () => {
    const req = new Request('http://localhost/', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' },
    });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip', () => {
    const req = new Request('http://localhost/', {
      headers: { 'x-real-ip': '10.0.0.1' },
    });
    expect(getClientIp(req)).toBe('10.0.0.1');
  });

  it('returns "unknown" when no IP headers present', () => {
    const req = new Request('http://localhost/');
    expect(getClientIp(req)).toBe('unknown');
  });
});
