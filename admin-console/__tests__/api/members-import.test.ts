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
          select: () => Promise.resolve({
            data: [{ id: 'existing-id', membership_id: 'FAM001' }],
            error: null,
          }),
        };
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

  it('updates existing families and replaces their members', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'families') {
        return {
          select: () => Promise.resolve({
            data: [{ id: 'existing-fam-id', membership_id: 'FAM001' }],
            error: null,
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

    const rows = [makeRow({ FamilyID: 'FAM001' })];
    const res = await POST(makeRequest({ rows, mode: 'import' }));
    expect(res.status).toBe(200);
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
