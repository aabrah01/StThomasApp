/**
 * Tests for user management API routes:
 *   POST /api/users/invite
 *   POST /api/users/reset-password
 *   DELETE /api/users/[id]
 *   PATCH /api/users/role
 */
import { NextResponse } from 'next/server';

jest.mock('@/lib/requireAdmin', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ userId: 'admin-user-id' }),
  isError: (r: unknown) => r instanceof NextResponse,
}));

// Rate limiter — allow all requests by default in tests
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue(true),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));

const mockFrom = jest.fn();
const mockAdminInvite = jest.fn();
const mockAdminDeleteUser = jest.fn();
const mockAdminGetUser = jest.fn();
const mockResetPasswordForEmail = jest.fn();

jest.mock('@/lib/supabase', () => ({
  createAdminSupabase: () => ({
    from: mockFrom,
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
      admin: {
        inviteUserByEmail: mockAdminInvite,
        deleteUser: mockAdminDeleteUser,
        getUserById: mockAdminGetUser,
      },
    },
  }),
}));

// ── Invite ────────────────────────────────────────────────────────────────────

import { POST as invitePost } from '@/app/api/users/invite/route';

const makeInviteRequest = (body: unknown) =>
  new Request('http://localhost/api/users/invite', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

describe('POST /api/users/invite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminInvite.mockResolvedValue({
      data: { user: { id: 'new-user-id' } },
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'members') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ count: 1, error: null }),
          }),
        };
      }
      return {
        upsert: () => Promise.resolve({ data: null, error: null }),
        insert: () => Promise.resolve({ data: null, error: null }),
      };
    });
    const { checkRateLimit } = require('@/lib/rateLimit');
    checkRateLimit.mockReturnValue(true);
  });

  it('invites a valid user and returns success', async () => {
    const res = await invitePost(makeInviteRequest({ email: 'new@example.com', role: 'member' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('returns 400 for invalid email', async () => {
    const res = await invitePost(makeInviteRequest({ email: 'not-an-email', role: 'member' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid role', async () => {
    const res = await invitePost(makeInviteRequest({ email: 'user@example.com', role: 'superuser' }));
    expect(res.status).toBe(400);
  });

  it('returns 429 when rate limit exceeded', async () => {
    const { checkRateLimit } = require('@/lib/rateLimit');
    checkRateLimit.mockReturnValue(false);

    const res = await invitePost(makeInviteRequest({ email: 'user@example.com', role: 'member' }));
    expect(res.status).toBe(429);
  });

  it('returns 400 when email is not in the members table', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'members') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
          }),
        };
      }
      return { insert: () => Promise.resolve({ data: null, error: null }) };
    });

    const res = await invitePost(makeInviteRequest({ email: 'outsider@example.com', role: 'member' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/registered member/i);
  });

  it('returns 400 when Supabase invite fails but does not leak internal error', async () => {
    mockAdminInvite.mockResolvedValue({ data: {}, error: { message: 'Email already registered' } });

    const res = await invitePost(makeInviteRequest({ email: 'exists@example.com', role: 'member' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    // Must not leak raw Supabase error
    expect(json.error).toBe('Failed to send invitation');
  });
});

// ── Reset Password ────────────────────────────────────────────────────────────

import { POST as resetPost } from '@/app/api/users/reset-password/route';

const makeResetRequest = (body: unknown) =>
  new Request('http://localhost/api/users/reset-password', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

describe('POST /api/users/reset-password', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, NEXT_PUBLIC_SITE_URL: 'https://admin.example.com' };
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      insert: () => Promise.resolve({ data: null, error: null }),
    });
    const { checkRateLimit } = require('@/lib/rateLimit');
    checkRateLimit.mockReturnValue(true);
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('always returns success (no email enumeration)', async () => {
    const res = await resetPost(makeResetRequest({ email: 'user@example.com' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('returns success even for unknown email (prevents enumeration)', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: { message: 'User not found' } });
    const res = await resetPost(makeResetRequest({ email: 'unknown@example.com' }));
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid email format', async () => {
    const res = await resetPost(makeResetRequest({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });

  it('returns 429 when rate limited', async () => {
    const { checkRateLimit } = require('@/lib/rateLimit');
    checkRateLimit.mockReturnValue(false);

    const res = await resetPost(makeResetRequest({ email: 'user@example.com' }));
    expect(res.status).toBe(429);
  });
});

// ── Delete User ───────────────────────────────────────────────────────────────

import { DELETE } from '@/app/api/users/[id]/route';

type RouteParams = { params: Promise<{ id: string }> };

const makeDeleteRequest = () =>
  new Request('http://localhost/api/users/target-user-id', { method: 'DELETE' });

describe('DELETE /api/users/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminDeleteUser.mockResolvedValue({ error: null });
    mockAdminGetUser.mockResolvedValue({ data: { user: { email: 'member@example.com' } }, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_roles') {
        return {
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { role: 'member', email: 'member@example.com' }, error: null }),
            }),
          }),
        };
      }
      return { insert: () => Promise.resolve({ data: null, error: null }) };
    });
  });

  it('deletes a different user successfully', async () => {
    const params: RouteParams = { params: Promise.resolve({ id: 'target-user-id' }) };
    const res = await DELETE(makeDeleteRequest(), params);
    expect(res.status).toBe(200);
  });

  it('prevents admin from deleting their own account', async () => {
    // requireAdmin returns userId: 'admin-user-id', so deleting that same ID should fail
    const params: RouteParams = { params: Promise.resolve({ id: 'admin-user-id' }) };
    const res = await DELETE(makeDeleteRequest(), params);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/own account/i);
  });
});

// ── Role Update ───────────────────────────────────────────────────────────────

import { PATCH as rolePatch } from '@/app/api/users/role/route';

const makeRoleRequest = (body: unknown) =>
  new Request('http://localhost/api/users/role', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

describe('PATCH /api/users/role', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReturnValue({
      upsert: () => Promise.resolve({ data: null, error: null }),
      insert: () => Promise.resolve({ data: null, error: null }),
    });
  });

  it('updates role for a different user', async () => {
    const res = await rolePatch(makeRoleRequest({ userId: 'other-user-id', role: 'admin' }));
    expect(res.status).toBe(200);
  });

  it('rejects invalid role values', async () => {
    const res = await rolePatch(makeRoleRequest({ userId: 'other-user-id', role: 'superuser' }));
    expect(res.status).toBe(400);
  });

  it('prevents admin from demoting their own role', async () => {
    const res = await rolePatch(makeRoleRequest({ userId: 'admin-user-id', role: 'member' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/own role/i);
  });
});
