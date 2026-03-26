/**
 * Tests for POST /api/contributions/import
 */
import { NextResponse } from 'next/server';

jest.mock('@/lib/requireAdmin', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ userId: 'test-admin' }),
  isError: (r: unknown) => r instanceof NextResponse,
}));

const mockFamiliesSelect = jest.fn();
const mockContributionsUpsert = jest.fn();
const mockAuditInsert = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  createAdminSupabase: () => ({ from: mockFrom }),
}));

import { POST } from '@/app/api/contributions/import/route';

const FAMILIES = [
  { id: 'fam-1', family_name: 'Smith Family' },
  { id: 'fam-2', family_name: 'Johnson Family' },
];

const makeRequest = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/contributions/import', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
  });

beforeEach(() => {
  jest.clearAllMocks();

  mockFrom.mockImplementation((table: string) => {
    if (table === 'families') {
      return { select: () => Promise.resolve({ data: FAMILIES, error: null }) };
    }
    if (table === 'contributions') {
      return { upsert: () => Promise.resolve({ data: null, error: null }) };
    }
    return { insert: () => Promise.resolve({ data: null, error: null }) };
  });
});

describe('POST /api/contributions/import', () => {
  it('imports matching rows successfully', async () => {
    const rows = [
      { familyName: 'Smith Family', date: '2024-01-15', amount: '100.00', category: 'General Fund' },
      { familyName: 'Johnson Family', date: '2024-02-10', amount: '250', category: 'Building Fund' },
    ];
    const res = await POST(makeRequest({ rows }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.count).toBe(2);
    expect(json.unmatched).toHaveLength(0);
  });

  it('tracks unmatched family names', async () => {
    const rows = [
      { familyName: 'Unknown Family', date: '2024-01-15', amount: '100', category: 'General' },
      { familyName: 'Smith Family', date: '2024-01-15', amount: '50', category: 'General' },
    ];
    const res = await POST(makeRequest({ rows }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.count).toBe(1);
    expect(json.unmatched).toContain('Unknown Family');
  });

  it('returns 400 when rows is not an array', async () => {
    const res = await POST(makeRequest({ rows: 'not-an-array' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when no rows matched families', async () => {
    const rows = [
      { familyName: 'No Match', date: '2024-01-15', amount: '100', category: 'General' },
    ];
    const res = await POST(makeRequest({ rows }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/No rows matched/);
  });

  it('returns 400 when rows exceeds MAX_ROWS (5000)', async () => {
    const rows = Array(5001).fill({ familyName: 'Smith Family', date: '2024-01-01', amount: '10', category: 'General' });
    const res = await POST(makeRequest({ rows }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/5000/);
  });

  it('skips rows with zero or negative amounts', async () => {
    const rows = [
      { familyName: 'Smith Family', date: '2024-01-15', amount: '0', category: 'General' },
      { familyName: 'Smith Family', date: '2024-01-15', amount: '-50', category: 'General' },
    ];
    const res = await POST(makeRequest({ rows }));
    expect(res.status).toBe(400); // all rows skipped → no match
  });

  it('skips rows with invalid date format', async () => {
    const rows = [
      { familyName: 'Smith Family', date: 'Jan 15 2024', amount: '100', category: 'General' },
    ];
    const res = await POST(makeRequest({ rows }));
    expect(res.status).toBe(400);
  });

  it('returns 413 when content-length exceeds limit', async () => {
    const res = await POST(makeRequest({ rows: [] }, { 'content-length': '999999999' }));
    expect(res.status).toBe(413);
  });

  it('matching is case-insensitive', async () => {
    const rows = [
      { familyName: 'smith family', date: '2024-01-15', amount: '100', category: 'General' },
    ];
    const res = await POST(makeRequest({ rows }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.count).toBe(1);
  });

  it('returns 400 when DB upsert fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'families') {
        return { select: () => Promise.resolve({ data: FAMILIES, error: null }) };
      }
      if (table === 'contributions') {
        return { upsert: () => Promise.resolve({ data: null, error: { message: 'DB error' } }) };
      }
      return { insert: () => Promise.resolve({ data: null, error: null }) };
    });

    const rows = [
      { familyName: 'Smith Family', date: '2024-01-15', amount: '100', category: 'General' },
    ];
    const res = await POST(makeRequest({ rows }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Import failed');
  });
});
