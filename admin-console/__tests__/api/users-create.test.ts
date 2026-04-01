/**
 * Tests for:
 *   POST /api/users/create
 *   PATCH /api/users/hoh
 */
import { NextResponse } from 'next/server';

jest.mock('@/lib/requireAdmin', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ userId: 'admin-user-id' }),
  isError: (r: unknown) => r instanceof NextResponse,
}));

jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue(true),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));

const mockFrom = jest.fn();
const mockAdminCreateUser = jest.fn();

jest.mock('@/lib/supabase', () => ({
  createAdminSupabase: () => ({
    from: mockFrom,
    auth: {
      admin: { createUser: mockAdminCreateUser },
    },
  }),
}));

// ── POST /api/users/create ────────────────────────────────────────────────────

import { POST as createPost } from '@/app/api/users/create/route';

const makeCreateRequest = (body: unknown) =>
  new Request('http://localhost/api/users/create', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

describe('POST /api/users/create', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminCreateUser.mockResolvedValue({
      data: { user: { id: 'new-user-id', email: 'member@example.com' } },
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'members') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue(
              Promise.resolve({ count: 1, error: null })
            ),
          }),
        };
      }
      return {
        upsert: () => Promise.resolve({ error: null }),
        insert: () => Promise.resolve({ error: null }),
      };
    });
    const { checkRateLimit } = require('@/lib/rateLimit');
    checkRateLimit.mockReturnValue(true);
  });

  it('creates a user for a registered member email', async () => {
    const res = await createPost(makeCreateRequest({
      email: 'member@example.com',
      password: 'securepass123',
      role: 'member',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('new-user-id');
    expect(json.email).toBe('member@example.com');
  });

  it('returns 400 when email is not in the members table', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'members') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue(
              Promise.resolve({ count: 0, error: null })
            ),
          }),
        };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    const res = await createPost(makeCreateRequest({
      email: 'outsider@example.com',
      password: 'securepass123',
      role: 'member',
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/registered member/i);
  });

  it('returns 400 for invalid email format', async () => {
    const res = await createPost(makeCreateRequest({
      email: 'not-an-email',
      password: 'securepass123',
      role: 'member',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is too short (< 8 chars)', async () => {
    const res = await createPost(makeCreateRequest({
      email: 'member@example.com',
      password: 'short',
      role: 'member',
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/8 characters/i);
  });

  it('returns 400 when password exceeds 72 characters', async () => {
    const res = await createPost(makeCreateRequest({
      email: 'member@example.com',
      password: 'a'.repeat(73),
      role: 'member',
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/72 characters/i);
  });

  it('returns 400 for invalid role', async () => {
    const res = await createPost(makeCreateRequest({
      email: 'member@example.com',
      password: 'securepass123',
      role: 'superuser',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when Supabase reports email already exists', async () => {
    mockAdminCreateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Email already registered' },
    });

    const res = await createPost(makeCreateRequest({
      email: 'member@example.com',
      password: 'securepass123',
      role: 'member',
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/already exists/i);
  });

  it('returns 429 when rate limit exceeded', async () => {
    const { checkRateLimit } = require('@/lib/rateLimit');
    checkRateLimit.mockReturnValue(false);

    const res = await createPost(makeCreateRequest({
      email: 'member@example.com',
      password: 'securepass123',
      role: 'member',
    }));
    expect(res.status).toBe(429);
  });

  it('returns 401 when caller is not admin', async () => {
    const { requireAdmin } = require('@/lib/requireAdmin');
    requireAdmin.mockResolvedValueOnce(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));

    const res = await createPost(makeCreateRequest({
      email: 'member@example.com',
      password: 'securepass123',
      role: 'member',
    }));
    expect(res.status).toBe(401);
  });

  it('succeeds with member role when role is omitted', async () => {
    // validateRole treats missing/falsy role as valid (defaults to 'member')
    const res = await createPost(makeCreateRequest({
      email: 'member@example.com',
      password: 'securepass123',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.role).toBe('member');
  });
});

// ── PATCH /api/users/hoh ─────────────────────────────────────────────────────

import { PATCH as hohPatch } from '@/app/api/users/hoh/route';

const makeHohRequest = (body: unknown) =>
  new Request('http://localhost/api/users/hoh', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

describe('PATCH /api/users/hoh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockImplementation(() => ({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      insert: () => Promise.resolve({ error: null }),
    }));
  });

  it('sets isHoh to true successfully', async () => {
    const res = await hohPatch(makeHohRequest({ memberId: 'member-uuid', isHoh: true }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('sets isHoh to false successfully', async () => {
    const res = await hohPatch(makeHohRequest({ memberId: 'member-uuid', isHoh: false }));
    expect(res.status).toBe(200);
  });

  it('returns 400 when memberId is missing', async () => {
    const res = await hohPatch(makeHohRequest({ isHoh: true }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/memberId/i);
  });

  it('returns 400 when isHoh is not a boolean', async () => {
    const res = await hohPatch(makeHohRequest({ memberId: 'member-uuid', isHoh: 'yes' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/boolean/i);
  });

  it('returns 400 when DB update fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'members') {
        return { update: () => ({ eq: () => Promise.resolve({ error: { message: 'DB error' } }) }) };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    const res = await hohPatch(makeHohRequest({ memberId: 'member-uuid', isHoh: true }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/HOH/i);
  });

  it('returns 401 when caller is not admin', async () => {
    const { requireAdmin } = require('@/lib/requireAdmin');
    requireAdmin.mockResolvedValueOnce(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));

    const res = await hohPatch(makeHohRequest({ memberId: 'member-uuid', isHoh: true }));
    expect(res.status).toBe(401);
  });
});
