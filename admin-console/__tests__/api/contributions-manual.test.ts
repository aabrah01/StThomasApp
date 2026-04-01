/**
 * Tests for:
 *   POST /api/contributions  (manual single-entry)
 *   PATCH /api/families/[id]
 *   DELETE /api/families/[id]
 */
import { NextResponse } from 'next/server';

jest.mock('@/lib/requireAdmin', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ userId: 'test-admin' }),
  isError: (r: unknown) => r instanceof NextResponse,
}));

const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  createAdminSupabase: () => ({ from: mockFrom }),
}));

// ── POST /api/contributions ───────────────────────────────────────────────────

import { POST as contributionPost } from '@/app/api/contributions/route';

const makeContribRequest = (body: unknown) =>
  new Request('http://localhost/api/contributions', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

describe('POST /api/contributions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'contributions') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'contrib-uuid' }, error: null }),
            }),
          }),
        };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });
  });

  it('creates a contribution and returns the new id', async () => {
    const res = await contributionPost(makeContribRequest({
      familyId: 'fam-uuid-123',
      date: '2026-01-15',
      amount: 250.00,
      category: 'General Fund',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('contrib-uuid');
  });

  it('defaults category to General Fund when omitted', async () => {
    const res = await contributionPost(makeContribRequest({
      familyId: 'fam-uuid-123',
      date: '2026-01-15',
      amount: 100,
    }));
    expect(res.status).toBe(200);
  });

  it('returns 400 when familyId is missing', async () => {
    const res = await contributionPost(makeContribRequest({
      date: '2026-01-15',
      amount: 100,
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/familyId/i);
  });

  it('returns 400 for invalid date format', async () => {
    const res = await contributionPost(makeContribRequest({
      familyId: 'fam-uuid-123',
      date: 'January 15 2026',
      amount: 100,
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for negative amount', async () => {
    const res = await contributionPost(makeContribRequest({
      familyId: 'fam-uuid-123',
      date: '2026-01-15',
      amount: -50,
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for zero amount', async () => {
    const res = await contributionPost(makeContribRequest({
      familyId: 'fam-uuid-123',
      date: '2026-01-15',
      amount: 0,
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when DB insert fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'contributions') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error: { message: 'DB error' } }),
            }),
          }),
        };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    const res = await contributionPost(makeContribRequest({
      familyId: 'fam-uuid-123',
      date: '2026-01-15',
      amount: 100,
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Failed to add contribution');
  });

  it('returns 401 when caller is not admin', async () => {
    const { requireAdmin } = require('@/lib/requireAdmin');
    requireAdmin.mockResolvedValueOnce(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));

    const res = await contributionPost(makeContribRequest({
      familyId: 'fam-uuid-123',
      date: '2026-01-15',
      amount: 100,
    }));
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/families/[id] ──────────────────────────────────────────────────

import { PATCH as familyPatch, DELETE as familyDelete } from '@/app/api/families/[id]/route';

type RouteParams = { params: Promise<{ id: string }> };
const familyParams: RouteParams = { params: Promise.resolve({ id: 'fam-uuid-123' }) };

const makePatchRequest = (body: unknown) =>
  new Request('http://localhost/api/families/fam-uuid-123', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

describe('PATCH /api/families/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'families') {
        return { update: () => ({ eq: () => Promise.resolve({ error: null }) }) };
      }
      if (table === 'members') {
        return {
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
          insert: () => Promise.resolve({ error: null }),
        };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });
  });

  it('updates a family successfully', async () => {
    const res = await familyPatch(makePatchRequest({
      familyName: 'Updated Family',
      membershipId: 'MEM001',
    }), familyParams);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('replaces members when members array is provided', async () => {
    const membersInsert = jest.fn().mockResolvedValue({ error: null });
    const membersDelete = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'families') {
        return { update: () => ({ eq: () => Promise.resolve({ error: null }) }) };
      }
      if (table === 'members') {
        return { delete: membersDelete, insert: membersInsert };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    const res = await familyPatch(makePatchRequest({
      familyName: 'Smith Family',
      membershipId: 'MEM001',
      members: [
        { firstName: 'John', lastName: 'Smith', isHeadOfHousehold: true },
        { firstName: 'Jane', lastName: 'Smith', isHeadOfHousehold: false },
      ],
    }), familyParams);
    expect(res.status).toBe(200);
    expect(membersDelete).toHaveBeenCalled();
    expect(membersInsert).toHaveBeenCalled();
  });

  it('returns 400 when familyName is missing', async () => {
    const res = await familyPatch(makePatchRequest({ membershipId: 'MEM001' }), familyParams);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/required/i);
  });

  it('returns 400 for invalid photoUrl', async () => {
    const res = await familyPatch(makePatchRequest({
      familyName: 'Smith Family',
      membershipId: 'MEM001',
      photoUrl: 'javascript:alert(1)',
    }), familyParams);
    expect(res.status).toBe(400);
  });

  it('returns 400 when family DB update fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'families') {
        return { update: () => ({ eq: () => Promise.resolve({ error: { message: 'DB error' } }) }) };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    const res = await familyPatch(makePatchRequest({
      familyName: 'Smith Family',
      membershipId: 'MEM001',
    }), familyParams);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Failed to update family');
  });
});

// ── DELETE /api/families/[id] ─────────────────────────────────────────────────

describe('DELETE /api/families/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'families') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { family_name: 'Smith Family' }, error: null }) }) }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      if (table === 'members') {
        return { delete: () => ({ eq: () => Promise.resolve({ error: null }) }) };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });
  });

  it('deletes a family and its members successfully', async () => {
    const req = new Request('http://localhost/api/families/fam-uuid-123', { method: 'DELETE' });
    const res = await familyDelete(req, familyParams);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('returns 401 when caller is not admin', async () => {
    const { requireAdmin } = require('@/lib/requireAdmin');
    requireAdmin.mockResolvedValueOnce(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));

    const req = new Request('http://localhost/api/families/fam-uuid-123', { method: 'DELETE' });
    const res = await familyDelete(req, familyParams);
    expect(res.status).toBe(401);
  });
});
