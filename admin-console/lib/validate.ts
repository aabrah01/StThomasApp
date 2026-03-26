/** Simple server-side input validators for API routes. */

const ALLOWED_URL_PROTOCOLS = ['https:', 'http:'];
const MAX_STRING = 255;
const MAX_AMOUNT = 1_000_000;
const MIN_AMOUNT = 0.01;
const ALLOWED_DOC_TYPES = ['tax-letter', 'annual-report', 'receipt', 'other'];
const ALLOWED_ROLES = ['admin', 'member'];

export function validateUrl(value: unknown, field = 'url'): string | null {
  if (!value) return null;
  if (typeof value !== 'string') return `${field} must be a string`;
  try {
    const u = new URL(value);
    if (!ALLOWED_URL_PROTOCOLS.includes(u.protocol)) {
      return `${field} must use http or https`;
    }
  } catch {
    return `${field} is not a valid URL`;
  }
  return null;
}

export function validateString(value: unknown, field: string, required = false, max = MAX_STRING): string | null {
  if (!value || value === '') {
    return required ? `${field} is required` : null;
  }
  if (typeof value !== 'string') return `${field} must be a string`;
  if (value.length > max) return `${field} must be ${max} characters or less`;
  return null;
}

export function validateEmail(value: unknown, field = 'email'): string | null {
  if (!value) return null;
  if (typeof value !== 'string') return `${field} must be a string`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `${field} is not a valid email`;
  return null;
}

export function validateAmount(value: unknown): string | null {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (typeof n !== 'number' || isNaN(n)) return 'amount must be a number';
  if (n < MIN_AMOUNT) return `amount must be at least ${MIN_AMOUNT}`;
  if (n > MAX_AMOUNT) return `amount must be ${MAX_AMOUNT} or less`;
  return null;
}

export function validateYear(value: unknown): string | null {
  const n = typeof value === 'string' ? parseInt(value, 10) : value;
  if (typeof n !== 'number' || isNaN(n)) return 'year must be a number';
  if (n < 2000 || n > 2100) return 'year must be between 2000 and 2100';
  return null;
}

export function validateDocType(value: unknown): string | null {
  if (!value) return null;
  if (!ALLOWED_DOC_TYPES.includes(value as string)) {
    return `type must be one of: ${ALLOWED_DOC_TYPES.join(', ')}`;
  }
  return null;
}

export function validateRole(value: unknown): string | null {
  if (!value) return null;
  if (!ALLOWED_ROLES.includes(value as string)) {
    return `role must be one of: ${ALLOWED_ROLES.join(', ')}`;
  }
  return null;
}

export function validateDate(value: unknown, field = 'date'): string | null {
  if (!value) return `${field} is required`;
  if (typeof value !== 'string') return `${field} must be a string`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${field} must be YYYY-MM-DD`;
  const d = new Date(value);
  if (isNaN(d.getTime())) return `${field} is not a valid date`;
  return null;
}

/** Collect errors from validators, return first if any, else null */
export function firstError(...errors: (string | null)[]): string | null {
  return errors.find(e => e !== null) ?? null;
}
