import {
  validateUrl,
  validateString,
  validateEmail,
  validateAmount,
  validateYear,
  validateDocType,
  validateRole,
  validateDate,
  firstError,
} from '@/lib/validate';

// ── validateUrl ───────────────────────────────────────────────────────────────

describe('validateUrl', () => {
  it('returns null for undefined/null/empty', () => {
    expect(validateUrl(undefined)).toBeNull();
    expect(validateUrl(null)).toBeNull();
    expect(validateUrl('')).toBeNull();
  });

  it('accepts https URLs', () => {
    expect(validateUrl('https://example.com/file.pdf')).toBeNull();
  });

  it('accepts http URLs', () => {
    expect(validateUrl('http://example.com')).toBeNull();
  });

  it('rejects non-string', () => {
    expect(validateUrl(42)).toBeTruthy();
  });

  it('rejects invalid URL', () => {
    expect(validateUrl('not-a-url')).toMatch(/not a valid URL/i);
  });

  it('rejects ftp:// and javascript: protocols', () => {
    expect(validateUrl('ftp://example.com')).toMatch(/http or https/i);
    expect(validateUrl('javascript:alert(1)')).toMatch(/http or https/i);
  });

  it('uses custom field name in error', () => {
    expect(validateUrl('bad', 'photoUrl')).toMatch(/photoUrl/);
  });
});

// ── validateString ────────────────────────────────────────────────────────────

describe('validateString', () => {
  it('returns null for optional empty string', () => {
    expect(validateString('', 'name')).toBeNull();
    expect(validateString(null, 'name')).toBeNull();
    expect(validateString(undefined, 'name')).toBeNull();
  });

  it('returns error when required and empty', () => {
    expect(validateString('', 'name', true)).toMatch(/required/);
    expect(validateString(null, 'name', true)).toMatch(/required/);
  });

  it('accepts valid string', () => {
    expect(validateString('Smith Family', 'familyName', true)).toBeNull();
  });

  it('rejects non-string', () => {
    expect(validateString(42, 'name')).toMatch(/must be a string/);
  });

  it('rejects string exceeding max', () => {
    expect(validateString('a'.repeat(256), 'name')).toMatch(/255 characters/);
  });

  it('respects custom max length', () => {
    expect(validateString('a'.repeat(101), 'name', false, 100)).toMatch(/100 characters/);
    expect(validateString('a'.repeat(100), 'name', false, 100)).toBeNull();
  });
});

// ── validateEmail ─────────────────────────────────────────────────────────────

describe('validateEmail', () => {
  it('returns null for empty', () => {
    expect(validateEmail('')).toBeNull();
    expect(validateEmail(null)).toBeNull();
    expect(validateEmail(undefined)).toBeNull();
  });

  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com')).toBeNull();
    expect(validateEmail('user+tag@sub.domain.co')).toBeNull();
  });

  it('rejects emails missing @', () => {
    expect(validateEmail('notanemail')).toMatch(/not a valid email/i);
  });

  it('rejects emails missing domain part', () => {
    expect(validateEmail('user@')).toMatch(/not a valid email/i);
  });

  it('rejects emails with spaces', () => {
    expect(validateEmail('user @example.com')).toMatch(/not a valid email/i);
  });

  it('rejects non-string', () => {
    expect(validateEmail(123)).toMatch(/must be a string/);
  });
});

// ── validateAmount ────────────────────────────────────────────────────────────

describe('validateAmount', () => {
  it('accepts valid amounts', () => {
    expect(validateAmount(100)).toBeNull();
    expect(validateAmount(0.01)).toBeNull();
    expect(validateAmount(1_000_000)).toBeNull();
    expect(validateAmount('50.25')).toBeNull();
  });

  it('rejects zero and negative', () => {
    expect(validateAmount(0)).toMatch(/at least 0.01/);
    expect(validateAmount(-1)).toMatch(/at least 0.01/);
  });

  it('rejects amounts above max', () => {
    expect(validateAmount(1_000_001)).toMatch(/1000000 or less/);
  });

  it('rejects non-numeric', () => {
    expect(validateAmount('abc')).toMatch(/must be a number/);
    expect(validateAmount(null)).toMatch(/must be a number/);
  });

  it('parses numeric strings', () => {
    expect(validateAmount('999.99')).toBeNull();
  });
});

// ── validateYear ──────────────────────────────────────────────────────────────

describe('validateYear', () => {
  it('accepts years 2000–2100', () => {
    expect(validateYear(2000)).toBeNull();
    expect(validateYear(2026)).toBeNull();
    expect(validateYear(2100)).toBeNull();
    expect(validateYear('2024')).toBeNull();
  });

  it('rejects years outside range', () => {
    expect(validateYear(1999)).toMatch(/between 2000 and 2100/);
    expect(validateYear(2101)).toMatch(/between 2000 and 2100/);
  });

  it('rejects non-numeric', () => {
    expect(validateYear('abc')).toMatch(/must be a number/);
    expect(validateYear(null)).toMatch(/must be a number/);
  });
});

// ── validateDocType ───────────────────────────────────────────────────────────

describe('validateDocType', () => {
  it('returns null for empty', () => {
    expect(validateDocType(null)).toBeNull();
    expect(validateDocType(undefined)).toBeNull();
    expect(validateDocType('')).toBeNull();
  });

  it('accepts allowed types', () => {
    for (const t of ['tax-letter', 'annual-report', 'receipt', 'other']) {
      expect(validateDocType(t)).toBeNull();
    }
  });

  it('rejects unknown types', () => {
    expect(validateDocType('invoice')).toMatch(/one of/);
    expect(validateDocType('<script>')).toMatch(/one of/);
  });
});

// ── validateRole ──────────────────────────────────────────────────────────────

describe('validateRole', () => {
  it('returns null for empty', () => {
    expect(validateRole(null)).toBeNull();
    expect(validateRole(undefined)).toBeNull();
  });

  it('accepts admin and member', () => {
    expect(validateRole('admin')).toBeNull();
    expect(validateRole('member')).toBeNull();
  });

  it('rejects other values', () => {
    expect(validateRole('superuser')).toMatch(/one of/);
    expect(validateRole('ADMIN')).toMatch(/one of/);
  });
});

// ── validateDate ──────────────────────────────────────────────────────────────

describe('validateDate', () => {
  it('accepts valid ISO dates', () => {
    expect(validateDate('2024-01-15')).toBeNull();
    expect(validateDate('2000-12-31')).toBeNull();
  });

  it('returns error when empty', () => {
    expect(validateDate(null)).toMatch(/required/);
    expect(validateDate(undefined)).toMatch(/required/);
    expect(validateDate('')).toMatch(/required/);
  });

  it('rejects non-ISO format', () => {
    expect(validateDate('01/15/2024')).toMatch(/YYYY-MM-DD/);
    expect(validateDate('2024/01/15')).toMatch(/YYYY-MM-DD/);
  });

  it('rejects invalid calendar dates', () => {
    // Month 13 is not a real month — reliably invalid across all JS runtimes
    expect(validateDate('2024-13-01')).toMatch(/not a valid date/i);
  });

  it('rejects non-string', () => {
    expect(validateDate(20240115)).toMatch(/must be a string/);
  });
});

// ── firstError ────────────────────────────────────────────────────────────────

describe('firstError', () => {
  it('returns null when all valid', () => {
    expect(firstError(null, null, null)).toBeNull();
  });

  it('returns first non-null error', () => {
    expect(firstError(null, 'first error', 'second error')).toBe('first error');
  });

  it('returns the only error', () => {
    expect(firstError(null, null, 'only error')).toBe('only error');
  });
});
