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

// The route takes an email and nothing else: the account is always an admin,
// sign-in is by PIN or Google (so there is no password), and the address does
// not have to belong to a member — staff addresses are expected.
describe('POST /api/users/create', () => {
  let memberUsersUpsert: jest.Mock;

  // `members` holds the rows sharing the new user's email; the route links each.
  const mockTables = (members: { id: string }[]) => {
    memberUsersUpsert = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'members') {
        return { select: () => ({ eq: () => Promise.resolve({ data: members, error: null }) }) };
      }
      if (table === 'member_users') {
        return { upsert: memberUsersUpsert };
      }
      return {
        upsert: () => Promise.resolve({ error: null }),
        insert: () => Promise.resolve({ error: null }),
      };
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminCreateUser.mockResolvedValue({
      data: { user: { id: 'new-user-id', email: 'member@example.com' } },
      error: null,
    });
    mockTables([{ id: 'member-1' }]);
    const { checkRateLimit } = require('@/lib/rateLimit');
    checkRateLimit.mockReturnValue(true);
  });

  it('creates an admin account for a valid email', async () => {
    const res = await createPost(makeCreateRequest({ email: 'member@example.com' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ id: 'new-user-id', email: 'member@example.com', role: 'admin' });
  });

  it('creates the account without a password', async () => {
    await createPost(makeCreateRequest({ email: 'member@example.com' }));
    expect(mockAdminCreateUser).toHaveBeenCalledWith({
      email: 'member@example.com',
      email_confirm: true,
    });
  });

  it('links the new user to every member sharing the email', async () => {
    mockTables([{ id: 'member-1' }, { id: 'member-2' }]);

    const res = await createPost(makeCreateRequest({ email: 'member@example.com' }));
    expect(res.status).toBe(200);
    expect(memberUsersUpsert).toHaveBeenCalledWith(
      [
        { user_id: 'new-user-id', member_id: 'member-1' },
        { user_id: 'new-user-id', member_id: 'member-2' },
      ],
      { onConflict: 'user_id,member_id' },
    );
  });

  it('still creates the account when the email matches no member', async () => {
    mockTables([]);

    const res = await createPost(makeCreateRequest({ email: 'staff@example.com' }));
    expect(res.status).toBe(200);
    expect(memberUsersUpsert).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid email format', async () => {
    const res = await createPost(makeCreateRequest({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when Supabase reports email already exists', async () => {
    mockAdminCreateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Email already registered' },
    });

    const res = await createPost(makeCreateRequest({ email: 'member@example.com' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/already exists/i);
  });

  it('returns 429 when rate limit exceeded', async () => {
    const { checkRateLimit } = require('@/lib/rateLimit');
    checkRateLimit.mockReturnValue(false);

    const res = await createPost(makeCreateRequest({ email: 'member@example.com' }));
    expect(res.status).toBe(429);
  });

  it('returns 401 when caller is not admin', async () => {
    const { requireAdmin } = require('@/lib/requireAdmin');
    requireAdmin.mockResolvedValueOnce(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));

    const res = await createPost(makeCreateRequest({ email: 'member@example.com' }));
    expect(res.status).toBe(401);
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
