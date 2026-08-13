/**
 * Tests for GET /api/cron/contributions-import — the auth guard and the
 * response contract. The import itself is covered by the lib tests.
 */
const mockRun = jest.fn();

jest.mock('@/lib/runDriveImport', () => ({
  runDriveImport: (...args: unknown[]) => mockRun(...args),
}));

import { GET } from '@/app/api/cron/contributions-import/route';

const SECRET = 'test-cron-secret';

const makeRequest = (authorization?: string) =>
  new Request('http://localhost/api/cron/contributions-import', {
    headers: authorization ? { authorization } : {},
  });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = SECRET;
  mockRun.mockResolvedValue({ status: 'skipped', reason: 'no_file' });
});

describe('auth', () => {
  it('runs the import when the secret matches', async () => {
    const res = await GET(makeRequest(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(mockRun).toHaveBeenCalledWith({ trigger: 'scheduled', actorId: 'cron' });
  });

  it('rejects a missing authorization header', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('rejects a wrong secret', async () => {
    const res = await GET(makeRequest('Bearer nope'));
    expect(res.status).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('rejects the secret without the Bearer prefix', async () => {
    const res = await GET(makeRequest(SECRET));
    expect(res.status).toBe(401);
  });

  it('rejects a secret that merely starts with the right value', async () => {
    const res = await GET(makeRequest(`Bearer ${SECRET}extra`));
    expect(res.status).toBe(401);
  });

  it('fails closed when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;
    // An unset secret must not mean "anything matches", including an empty bearer.
    expect((await GET(makeRequest('Bearer '))).status).toBe(401);
    expect((await GET(makeRequest())).status).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });
});

describe('responses', () => {
  it('returns the outcome for a skipped run', async () => {
    const res = await GET(makeRequest(`Bearer ${SECRET}`));
    expect(await res.json()).toEqual({ status: 'skipped', reason: 'no_file' });
  });

  it('returns 200 for an aborted import so Vercel does not retry it', async () => {
    mockRun.mockResolvedValue({ status: 'aborted', fileName: 'x.xlsx', message: 'gate failed' });
    const res = await GET(makeRequest(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('aborted');
  });

  it('returns 500 when the import throws', async () => {
    mockRun.mockRejectedValue(new Error('Drive API list failed (403)'));
    const res = await GET(makeRequest(`Bearer ${SECRET}`));
    expect(res.status).toBe(500);
    expect((await res.json()).message).toMatch(/403/);
  });
});
