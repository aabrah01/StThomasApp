import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { runDriveImport } from '@/lib/runDriveImport';

// Vercel Hobby allows one run per day; the work is a Drive list, a small
// download and one RPC, well inside the ceiling.
export const maxDuration = 60;

/** Constant-time compare that tolerates length differences. */
function secretMatches(header: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const provided = header?.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  // requireAdmin() reads a user session and would reject the cron, so this route
  // authenticates on the shared secret Vercel sends instead.
  if (!secretMatches(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const outcome = await runDriveImport({ trigger: 'scheduled', actorId: 'cron' });
    // 200 even on an aborted import: the run itself worked, and a non-2xx would
    // just make Vercel retry a file that will fail again.
    return NextResponse.json(outcome);
  } catch (err) {
    console.error('Scheduled contributions import failed:', err);
    return NextResponse.json(
      { status: 'failed', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
