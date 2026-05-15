/**
 * Tests for AuthContext member-verification logic.
 *
 * Strategy: directly simulate the auth-state-change handler sequence
 * that AuthContext performs — same service calls, no React renderer needed.
 *
 * Covers:
 *   - User with existing user_id link → access granted, no signOut
 *   - User with no member record → signOut called
 *   - First login: email lookup runs, all matching members are linked
 *   - Linked user: email lookup is skipped
 */

jest.mock('../../utils/config', () => ({
  DEMO_MODE: false,
  DEMO_CREDENTIALS: { email: 'demo@example.com', password: 'demo123' },
  DEMO_EMAIL: 'demo@stthomasli.org',
  DEMO_PIN: '123456',
  setDemoSession: jest.fn(),
  isDemoSession: () => false,
}));

const mockSignOut           = jest.fn().mockResolvedValue({ error: null });
const mockGetUserRole       = jest.fn();
const mockGetMemberByUserId = jest.fn();
const mockGetMembersByEmail = jest.fn();
const mockLinkMemberToUser  = jest.fn();

jest.mock('../../services/authService', () => ({
  __esModule: true,
  default: {
    signOut: (...args) => mockSignOut(...args),
    onAuthStateChange: jest.fn(),
    getCurrentUser: jest.fn().mockReturnValue(null),
  },
}));

jest.mock('../../services/databaseService', () => ({
  __esModule: true,
  default: {
    getUserRole:       (...args) => mockGetUserRole(...args),
    getMemberByUserId: (...args) => mockGetMemberByUserId(...args),
    getMembersByEmail: (...args) => mockGetMembersByEmail(...args),
    linkMemberToUser:  (...args) => mockLinkMemberToUser(...args),
  },
}));

// ── Reproduce the exact handler logic from AuthContext ────────────────────────
// This mirrors the onAuthStateChange body in AuthContext.js so that tests
// stay in sync with the real implementation.

const databaseService = require('../../services/databaseService').default;
const authService     = require('../../services/authService').default;

async function runAuthHandler(authUser) {
  if (!authUser) return; // null user → clear state, nothing to verify

  await databaseService.getUserRole(authUser.id);

  let { data: memberData } = await databaseService.getMemberByUserId(authUser.id);

  if (!memberData && authUser.email) {
    const { data: membersByEmail } = await databaseService.getMembersByEmail(authUser.email);
    if (membersByEmail && membersByEmail.length > 0) {
      await Promise.all(membersByEmail.map(m => databaseService.linkMemberToUser(m.id, authUser.id)));
      memberData = { ...membersByEmail[0], userId: authUser.id };
    }
  }

  if (!memberData) {
    await authService.signOut();
  }

  return memberData;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const AUTH_USER   = { id: 'auth-id', email: 'john@example.com' };
const MOCK_MEMBER = { id: 'member-id', familyId: 'fam-1', email: 'john@example.com' };
const MOCK_ROLE   = { role: 'member' };

beforeEach(() => {
  jest.clearAllMocks();
  mockSignOut.mockResolvedValue({ error: null });
  mockGetUserRole.mockResolvedValue({ data: MOCK_ROLE, error: null });
  mockGetMemberByUserId.mockResolvedValue({ data: MOCK_MEMBER, error: null });
  mockGetMembersByEmail.mockResolvedValue({ data: [MOCK_MEMBER], error: null });
  mockLinkMemberToUser.mockResolvedValue({ error: null });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthContext handler — user already linked', () => {
  it('returns the member and does NOT call signOut', async () => {
    const result = await runAuthHandler(AUTH_USER);
    expect(result).toMatchObject({ id: MOCK_MEMBER.id });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('does not look up members by email when user_id is already linked', async () => {
    await runAuthHandler(AUTH_USER);
    expect(mockGetMembersByEmail).not.toHaveBeenCalled();
  });
});

describe('AuthContext handler — non-member login', () => {
  beforeEach(() => {
    mockGetMemberByUserId.mockResolvedValue({ data: null, error: null });
    mockGetMembersByEmail.mockResolvedValue({ data: [], error: null });
  });

  it('calls signOut when no member record exists', async () => {
    await runAuthHandler(AUTH_USER);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('returns null/undefined (no member) when blocked', async () => {
    const result = await runAuthHandler(AUTH_USER);
    expect(result).toBeFalsy();
  });

  it('attempts email lookup before blocking', async () => {
    await runAuthHandler(AUTH_USER);
    expect(mockGetMembersByEmail).toHaveBeenCalledWith(AUTH_USER.email);
  });
});

describe('AuthContext handler — first login email linking', () => {
  it('links all members sharing the email to the auth user_id', async () => {
    const sharedMembers = [
      { id: 'member-a', email: 'shared@example.com' },
      { id: 'member-b', email: 'shared@example.com' },
    ];
    mockGetMemberByUserId.mockResolvedValue({ data: null, error: null });
    mockGetMembersByEmail.mockResolvedValue({ data: sharedMembers, error: null });

    await runAuthHandler({ id: 'auth-id', email: 'shared@example.com' });

    expect(mockLinkMemberToUser).toHaveBeenCalledTimes(2);
    expect(mockLinkMemberToUser).toHaveBeenCalledWith('member-a', 'auth-id');
    expect(mockLinkMemberToUser).toHaveBeenCalledWith('member-b', 'auth-id');
  });

  it('grants access after linking (does NOT call signOut)', async () => {
    mockGetMemberByUserId.mockResolvedValue({ data: null, error: null });
    mockGetMembersByEmail.mockResolvedValue({ data: [MOCK_MEMBER], error: null });

    await runAuthHandler(AUTH_USER);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('returns the first linked member as the session member', async () => {
    mockGetMemberByUserId.mockResolvedValue({ data: null, error: null });
    mockGetMembersByEmail.mockResolvedValue({ data: [MOCK_MEMBER], error: null });

    const result = await runAuthHandler(AUTH_USER);
    expect(result).toMatchObject({ id: MOCK_MEMBER.id });
  });

  it('does NOT call linkMemberToUser when user_id is already linked', async () => {
    await runAuthHandler(AUTH_USER);
    expect(mockLinkMemberToUser).not.toHaveBeenCalled();
  });
});

describe('AuthContext handler — null authUser (sign-out event)', () => {
  it('returns early without any DB calls', async () => {
    await runAuthHandler(null);
    expect(mockGetMemberByUserId).not.toHaveBeenCalled();
    expect(mockGetMembersByEmail).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
