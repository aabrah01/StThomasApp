/**
 * Tests for POST /api/members/import
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

import { POST } from '@/app/api/members/import/route';

const makeRequest = (body: unknown) =>
  new Request('http://localhost/api/members/import', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const makeRow = (overrides: Partial<Record<string, string>> = {}) => ({
  Name: 'John Smith',
  Alias: '',
  DOB: '',
  MemStatus: 'Active',
  Street: '123 Oak St',
  City: 'Springfield',
  Zip: '62701',
  State: 'IL',
  FamStatus: 'Active',
  FamilyID: 'FAM001',
  Email: 'john@example.com',
  CellPhone: '555-1234',
  ...overrides,
});

type Signup = { id: string; event_date: string; member_id: string; created_at: string };
type MemberRow = Record<string, unknown>;

// A select() result that can be awaited directly or narrowed with .in()/.eq().
const selectable = (data: unknown[]) =>
  Object.assign(Promise.resolve({ data, error: null }), {
    in: () => Promise.resolve({ data, error: null }),
    eq: () => Promise.resolve({ data, error: null }),
  });

// Import against a family that already exists: the route diffs it, snapshots
// links and pledges, wipes the members, re-inserts them from the CSV, then
// re-points what it snapshotted at the new rows.
const mockExistingFamily = (opts: {
  oldMembers: MemberRow[];
  newMembers: MemberRow[];
  meals?: Signup[];
  flowers?: Signup[];
}) => {
  const linkUpsert = jest.fn().mockResolvedValue({ error: null });
  const mealInsert = jest.fn().mockResolvedValue({ error: null });
  const flowerInsert = jest.fn().mockResolvedValue({ error: null });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'families') {
      return {
        select: () => selectable([{
          id: 'existing-fam-id', membership_id: 'FAM001', family_name: 'Old Family',
          address: null, city: null, state: null, zip: null, is_active: true,
        }]),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      };
    }
    if (table === 'members') {
      return {
        // The snapshot and the post-insert re-read hit the same table; the
        // requested columns say which one is asking.
        select: (cols: string) => selectable(
          cols.includes('member_users') || cols.includes('phone_number')
            ? opts.oldMembers
            : opts.newMembers
        ),
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        insert: () => Promise.resolve({ error: null }),
      };
    }
    if (table === 'meal_signups')   return { select: () => selectable(opts.meals ?? []), insert: mealInsert };
    if (table === 'flower_signups') return { select: () => selectable(opts.flowers ?? []), insert: flowerInsert };
    if (table === 'member_users')   return { upsert: linkUpsert };
    return { insert: () => Promise.resolve({ error: null }) };
  });

  return { linkUpsert, mealInsert, flowerInsert };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFrom.mockImplementation((table: string) => {
    if (table === 'families') {
      return {
        select: () => Promise.resolve({ data: [], error: null }),
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'new-fam-id' }, error: null }),
          }),
        }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      };
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

describe('POST /api/members/import — preview mode', () => {
  it('returns summary without writing data in preview mode', async () => {
    const rows = [makeRow(), makeRow({ Name: 'Jane Smith', FamilyID: 'FAM001' })];
    const res = await POST(makeRequest({ rows, mode: 'preview' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.summary).toBeDefined();
    expect(json.summary.totalMembers).toBe(2);
    expect(json.summary.totalFamilies).toBe(1);
  });

  it('identifies new vs existing families in preview', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'families') {
        return {
          select: () => selectable([{ id: 'existing-id', membership_id: 'FAM001' }]),
        };
      }
      if (table === 'members') {
        return { select: () => selectable([]) };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    const rows = [
      makeRow({ FamilyID: 'FAM001' }),
      makeRow({ Name: 'Alice Jones', FamilyID: 'FAM002' }),
    ];
    const res = await POST(makeRequest({ rows, mode: 'preview' }));
    const json = await res.json();
    expect(json.summary.updatedFamilies).toBe(1);
    expect(json.summary.newFamilies).toBe(1);
  });
});

describe('POST /api/members/import — import mode', () => {
  it('creates new families and members', async () => {
    const rows = [
      makeRow({ Name: 'John Smith', FamilyID: 'FAM001' }),
      makeRow({ Name: 'Jane Smith', FamilyID: 'FAM001' }),
    ];
    const res = await POST(makeRequest({ rows, mode: 'import' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.summary.newMembers).toBe(2);
    expect(json.errors).toHaveLength(0);
  });

  it('restores member links and pledges after re-inserting an existing family', async () => {
    const { linkUpsert, mealInsert, flowerInsert } = mockExistingFamily({
      oldMembers: [{
        id: 'old-1', email: 'john@example.com', first_name: 'John', last_name: 'Smith',
        member_users: [{ user_id: 'user-1' }],
      }],
      newMembers: [{ id: 'new-1', email: 'john@example.com', first_name: 'John', last_name: 'Smith' }],
      meals:   [{ id: 'meal-1',   event_date: '2026-12-25', member_id: 'old-1', created_at: '2026-08-01' }],
      flowers: [{ id: 'flower-1', event_date: '2026-12-25', member_id: 'old-1', created_at: '2026-08-01' }],
    });

    const res = await POST(makeRequest({ rows: [makeRow({ FamilyID: 'FAM001' })], mode: 'import' }));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(linkUpsert).toHaveBeenCalledWith(
      { user_id: 'user-1', member_id: 'new-1' },
      { onConflict: 'user_id,member_id' },
    );
    expect(mealInsert).toHaveBeenCalledWith([expect.objectContaining({ id: 'meal-1', member_id: 'new-1' })]);
    expect(flowerInsert).toHaveBeenCalledWith([expect.objectContaining({ id: 'flower-1', member_id: 'new-1' })]);
    expect(json.summary.orphanedLinks).toBe(0);
    expect(json.orphaned).toEqual([]);
  });

  it('reports an orphaned login when the member email changed, but keeps pledges', async () => {
    const { linkUpsert, mealInsert } = mockExistingFamily({
      oldMembers: [{
        id: 'old-1', email: 'john@example.com', first_name: 'John', last_name: 'Smith',
        member_users: [{ user_id: 'user-1' }],
      }],
      // Same person, new address — the link can't be re-matched, the pledge can.
      newMembers: [{ id: 'new-1', email: 'john.new@example.com', first_name: 'John', last_name: 'Smith' }],
      meals: [{ id: 'meal-1', event_date: '2026-12-25', member_id: 'old-1', created_at: '2026-08-01' }],
    });

    const res = await POST(makeRequest({
      rows: [makeRow({ FamilyID: 'FAM001', Email: 'john.new@example.com' })],
      mode: 'import',
    }));
    const json = await res.json();

    expect(linkUpsert).not.toHaveBeenCalled();
    expect(json.orphaned).toEqual(['john@example.com']);
    expect(json.summary.orphanedLinks).toBe(1);
    expect(json.errors.join(' ')).toMatch(/orphaned/i);
    expect(mealInsert).toHaveBeenCalledWith([expect.objectContaining({ member_id: 'new-1' })]);
  });

  it('flags pledges it cannot re-link when the member is renamed', async () => {
    const { mealInsert } = mockExistingFamily({
      oldMembers: [{ id: 'old-1', email: null, first_name: 'John', last_name: 'Smith' }],
      newMembers: [{ id: 'new-1', email: null, first_name: 'Jonathan', last_name: 'Smith' }],
      meals: [{ id: 'meal-1', event_date: '2026-12-25', member_id: 'old-1', created_at: '2026-08-01' }],
    });

    const res = await POST(makeRequest({
      rows: [makeRow({ Name: 'Jonathan Smith', FamilyID: 'FAM001' })],
      mode: 'import',
    }));
    const json = await res.json();

    expect(mealInsert).not.toHaveBeenCalled();
    expect(json.errors.join(' ')).toMatch(/could not be re-linked/i);
  });

  it('derives family name from the most common last name', async () => {
    // FAM001: Smith x2, Jones x1 → "Smith Family"
    const insertMock = jest.fn().mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: 'new-fam-id' }, error: null }) }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'families') {
        return { select: () => Promise.resolve({ data: [], error: null }), insert: insertMock };
      }
      if (table === 'members') {
        return {
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
          insert: () => Promise.resolve({ error: null }),
        };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    const rows = [
      makeRow({ Name: 'John Smith', FamilyID: 'FAM001' }),
      makeRow({ Name: 'Jane Smith', FamilyID: 'FAM001' }),
      makeRow({ Name: 'Alice Jones', FamilyID: 'FAM001' }),
    ];
    await POST(makeRequest({ rows, mode: 'import' }));
    const insertCall = insertMock.mock.calls[0][0];
    expect(insertCall.family_name).toBe('Smith Family');
  });

  it('correctly splits first and last name', async () => {
    const memberInsertMock = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'families') {
        return {
          select: () => Promise.resolve({ data: [], error: null }),
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'fam-id' }, error: null }) }) }),
        };
      }
      if (table === 'members') {
        return {
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
          insert: memberInsertMock,
        };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    const rows = [makeRow({ Name: 'Rev. Fr. Abey George', FamilyID: 'FAM001' })];
    await POST(makeRequest({ rows, mode: 'import' }));
    const inserted = memberInsertMock.mock.calls[0][0];
    expect(inserted[0].first_name).toBe('Rev. Fr. Abey');
    expect(inserted[0].last_name).toBe('George');
  });

  it('skips rows without a FamilyID', async () => {
    const rows = [makeRow({ FamilyID: '' })];
    const res = await POST(makeRequest({ rows, mode: 'import' }));
    const json = await res.json();
    expect(json.summary.totalFamilies).toBe(0);
  });

  it('handles single-word names gracefully', async () => {
    const memberInsertMock = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'families') {
        return {
          select: () => Promise.resolve({ data: [], error: null }),
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'fam-id' }, error: null }) }) }),
        };
      }
      if (table === 'members') {
        return {
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
          insert: memberInsertMock,
        };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    const rows = [makeRow({ Name: 'Madonna', FamilyID: 'FAM001' })];
    await POST(makeRequest({ rows, mode: 'import' }));
    const inserted = memberInsertMock.mock.calls[0][0];
    expect(inserted[0].first_name).toBe('Madonna');
    expect(inserted[0].last_name).toBe('');
  });

  it('returns 400 when rows is not an array', async () => {
    const res = await POST(makeRequest({ rows: 'invalid', mode: 'import' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when rows exceeds MAX_ROWS', async () => {
    const rows = Array(5001).fill(makeRow());
    const res = await POST(makeRequest({ rows, mode: 'import' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/5000/);
  });

  it('returns 401 when caller is not admin', async () => {
    const { requireAdmin } = require('@/lib/requireAdmin');
    requireAdmin.mockResolvedValueOnce(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));

    const res = await POST(makeRequest({ rows: [makeRow()], mode: 'import' }));
    expect(res.status).toBe(401);
  });
});
