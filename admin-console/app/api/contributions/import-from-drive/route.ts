import { requireAdmin, isError } from '@/lib/requireAdmin';
import { runDriveImport } from '@/lib/runDriveImport';
import { NextResponse } from 'next/server';

// Same pipeline as the nightly cron, triggered by the Import now button. The
// cron route cannot serve this: it authenticates on CRON_SECRET, not a session.
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  // `reimport` re-runs the last recorded file even though its contents are
  // unchanged — for when the directory has been corrected since.
  const { reimport } = await request.json().catch(() => ({ reimport: false }));

  try {
    const outcome = await runDriveImport({
      trigger: 'manual',
      actorId: auth.userId,
      reimport: reimport === true,
    });
    return NextResponse.json(outcome);
  } catch (err) {
    console.error('Manual Drive import failed:', err);
    return NextResponse.json(
      { status: 'failed', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
