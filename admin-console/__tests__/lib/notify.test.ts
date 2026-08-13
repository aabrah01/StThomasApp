/**
 * Tests for the import report email — subject lines, the member/non-member
 * split, the row cap, and the no-key fallback.
 */
const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  createAdminSupabase: () => ({ from: mockFrom }),
}));

import { sendImportReport, type ImportReport } from '@/lib/notify';

const RECIPIENTS = 'treasurer@example.org, admin@example.org';

let logged: string[];
let fetchMock: jest.Mock;

const baseReport: ImportReport = {
  trigger: 'scheduled',
  status: 'imported',
  fileName: 'Book2-3.xlsx',
  asofDate: '2026-08-03',
  rowCount: 957,
  totalAmount: 351650.54,
  memberEntries: 128,
  memberEntriesMatched: 122,
  unmatchedSplit: {
    members: [
      'Saju Samuel (5901)', 'Steve Simon (1501)', 'Nisha Joseph (3302)',
      'Gregory Cheriyan (2601)', 'Joel Abraham (4501)', 'Philip Mathew (7601)',
    ],
    other: ['Offertory', 'Geico Insurance', 'MMVS', 'Charity'],
  },
  rowErrors: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.RESEND_API_KEY;
  delete process.env.IMPORT_REPORT_FALLBACK_EMAIL;

  logged = [];
  jest.spyOn(console, 'log').mockImplementation(msg => { logged.push(String(msg)); });
  jest.spyOn(console, 'error').mockImplementation(() => {});

  fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => '' });
  global.fetch = fetchMock as unknown as typeof fetch;

  mockFrom.mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { report_recipients: RECIPIENTS } }) }) }),
  });
});

afterEach(() => jest.restoreAllMocks());

const send = async (over: Partial<ImportReport> = {}) => {
  await sendImportReport({ ...baseReport, ...over });
  return logged.join('\n');
};

describe('recipients', () => {
  it('sends nothing when none are configured and no fallback is set', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { report_recipients: null } }) }) }),
    });
    const output = await send();
    expect(fetchMock).not.toHaveBeenCalled();
    // Must say so rather than skipping silently — otherwise "no email arrived"
    // is indistinguishable from a send that failed.
    expect(output).toMatch(/no recipients configured/);
  });

  it('falls back to the env var when the database has none', async () => {
    process.env.IMPORT_REPORT_FALLBACK_EMAIL = 'fallback@example.org';
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { report_recipients: null } }) }) }),
    });
    expect(await send()).toContain('fallback@example.org');
  });

  it('falls back when the database is unreachable', async () => {
    process.env.IMPORT_REPORT_FALLBACK_EMAIL = 'fallback@example.org';
    mockFrom.mockImplementation(() => { throw new Error('connection refused'); });
    expect(await send()).toContain('fallback@example.org');
  });
});

describe('without an API key', () => {
  it('logs instead of sending', async () => {
    const output = await send();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(output).toContain('would email treasurer@example.org, admin@example.org');
    expect(output).toContain('Imported 957 rows');
  });
});

describe('with an API key', () => {
  beforeEach(() => { process.env.RESEND_API_KEY = 'test-key'; });

  it('posts to Resend with both recipients', async () => {
    await send();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(JSON.parse(init.body).to).toEqual(['treasurer@example.org', 'admin@example.org']);
  });

  it('sends from the verified church domain by default', async () => {
    await send();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toContain('webmaster@stthomasli.org');
  });

  it('lets IMPORT_REPORT_FROM override the sender', async () => {
    process.env.IMPORT_REPORT_FROM = 'test@example.org';
    await send();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toBe('test@example.org');
    delete process.env.IMPORT_REPORT_FROM;
  });

  it('never throws when Resend rejects the message', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 422, text: async () => 'domain not verified' });
    await expect(send()).resolves.toBeDefined();
  });

  it('never throws when the network fails', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    await expect(send()).resolves.toBeDefined();
  });
});

describe('subject', () => {
  // Default these to the production deployment so the [DEV] tag, which is
  // covered separately below, does not have to be repeated in every assertion.
  beforeEach(() => { process.env.VERCEL_ENV = 'production'; });
  afterEach(() => { delete process.env.VERCEL_ENV; });

  const subjectOf = async (over: Partial<ImportReport>) => {
    process.env.RESEND_API_KEY = 'test-key';
    await sendImportReport({ ...baseReport, ...over });
    return JSON.parse(fetchMock.mock.calls[0][1].body).subject;
  };

  it('names the row count and trigger on success', async () => {
    expect(await subjectOf({})).toBe('Contributions import — 957 rows (scheduled)');
  });

  it('distinguishes a manual run so a 2pm report is not mistaken for the nightly one', async () => {
    expect(await subjectOf({ trigger: 'manual' })).toContain('(manual)');
  });

  it('says no changes were made on an abort', async () => {
    expect(await subjectOf({ status: 'aborted' })).toMatch(/ABORTED — no changes made/);
  });

  it('flags an overridden import', async () => {
    expect(await subjectOf({ gatesOverridden: true })).toContain('checks overridden');
  });
});

describe('environment tag', () => {
  const subjectOf = async () => {
    process.env.RESEND_API_KEY = 'test-key';
    await sendImportReport(baseReport);
    return JSON.parse(fetchMock.mock.calls[0][1].body).subject;
  };

  afterEach(() => { delete process.env.VERCEL_ENV; });

  it('tags local development, where VERCEL_ENV is unset', async () => {
    expect(await subjectOf()).toBe('[DEV] Contributions import — 957 rows (scheduled)');
  });

  it('tags Vercel preview deployments, which point at the dev database', async () => {
    process.env.VERCEL_ENV = 'preview';
    expect(await subjectOf()).toMatch(/^\[DEV\] /);
  });

  it('leaves the production deployment untagged', async () => {
    process.env.VERCEL_ENV = 'production';
    expect(await subjectOf()).not.toContain('[DEV]');
  });

  it('tags aborted reports too', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    await sendImportReport({ ...baseReport, status: 'aborted' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).subject).toMatch(/^\[DEV\] .*ABORTED/);
  });
});

describe('body', () => {
  it('leads with members that failed to match', async () => {
    const output = await send();
    expect(output).toMatch(/Members not found in the directory \(6\)/);
  });

  it('names each unmatched member, not just their membership id', async () => {
    // A bare "5901" cannot be acted on without looking it up first.
    expect(await send()).toContain('Saju Samuel (5901)');
  });

  it('collapses non-member entries to a single line', async () => {
    const output = await send();
    expect(output).toMatch(/4 non-member entries .* were skipped as expected/);
    // The individual names must not be listed alongside the actionable ones.
    expect(output).not.toContain('Geico Insurance');
  });

  it('reports the member match rate', async () => {
    expect(await send()).toContain('122 of 128 member entries matched a family (95.3%)');
  });

  it('states that data is untouched on an abort', async () => {
    expect(await send({ status: 'aborted', message: 'Only 40 of 128 matched.' }))
      .toContain('untouched');
  });

  it('caps skipped rows at 100 and says how many more there are', async () => {
    const rowErrors = Array.from({ length: 130 }, (_, i) => ({
      row: i + 1, reason: 'Family not found', identifier: `fam-${i}`,
    }));
    const output = await send({ rowErrors });
    expect(output).toContain('Skipped rows (130)');
    expect(output).toContain('…and 30 more');
    expect(output).toContain('fam-99');
    expect(output).not.toContain('fam-100');
  });

  it('escapes HTML in file names', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    await sendImportReport({ ...baseReport, fileName: '<script>alert(1)</script>.xlsx' });
    const { html } = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
