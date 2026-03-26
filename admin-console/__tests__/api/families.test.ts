/**
 * Tests for POST /api/families
 * Mocks: requireAdmin (always returns admin context), createAdminSupabase (chainable mock)
 */
import { NextResponse } from 'next/server';

// ── Mock requireAdmin to bypass auth in all tests ─────────────────────────────
jest.mock('@/lib/requireAdmin', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ userId: 'test-admin' }),
  isError: (r: unknown) => r instanceof NextResponse,
}));

// ── Supabase mock factory ─────────────────────────────────────────────────────
const mockInsert = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  createAdminSupabase: () => ({ from: mockFrom }),
}));

import { POST } from '@/app/api/families/route';

const makeRequest = (body: Record<string, unknown>, headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/families', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
  });

beforeEach(() => {
  jest.clearAllMocks();

  // Default happy-path: insert family succeeds, insert members succeeds, audit succeeds
  mockInsert.mockImplementation(() => ({
    select: () => ({ single: () => Promise.resolve({ data: { id: 'fam-uuid-123' }, error: null }) }),
  }));

  mockFrom.mockImplementation((table: string) => {
    if (table === 'families') {
      return {
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'fam-uuid-123' }, error: null }),
          }),
        }),
      };
    }
    // members and audit_log
    return { insert: () => Promise.resolve({ data: null, error: null }) };
  });
});

describe('POST /api/families', () => {
  it('creates a family and returns the new id', async () => {
    const res = await POST(makeRequest({ familyName: 'Smith Family', membershipId: 'MEM001' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('fam-uuid-123');
  });

  it('returns 400 when familyName is missing', async () => {
    const res = await POST(makeRequest({ membershipId: 'MEM001' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/required/i);
  });

  it('returns 400 when membershipId is missing', async () => {
    const res = await POST(makeRequest({ familyName: 'Smith Family' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/required/i);
  });

  it('returns 400 for invalid email', async () => {
    const res = await POST(makeRequest({
      familyName: 'Smith Family',
      membershipId: 'MEM001',
      email: 'not-an-email',
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/email/i);
  });

  it('returns 400 for invalid photoUrl protocol', async () => {
    const res = await POST(makeRequest({
      familyName: 'Smith Family',
      membershipId: 'MEM001',
      photoUrl: 'javascript:alert(1)',
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/http or https/i);
  });

  it('returns 413 when content-length exceeds limit', async () => {
    const res = await POST(makeRequest(
      { familyName: 'Smith Family', membershipId: 'MEM001' },
      { 'content-length': '99999999' }
    ));
    expect(res.status).toBe(413);
  });

  it('returns 400 when DB insert fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'families') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error: { message: 'DB error' } }),
            }),
          }),
        };
      }
      return { insert: () => Promise.resolve({ data: null, error: null }) };
    });

    const res = await POST(makeRequest({ familyName: 'Smith Family', membershipId: 'MEM001' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    // Error message must be generic — no raw DB error leaked
    expect(json.error).toBe('Failed to create family');
  });

  it('returns 401 when requireAdmin returns an error response', async () => {
    const { requireAdmin } = require('@/lib/requireAdmin');
    requireAdmin.mockResolvedValueOnce(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));

    const res = await POST(makeRequest({ familyName: 'Smith Family', membershipId: 'MEM001' }));
    expect(res.status).toBe(401);
  });
});
