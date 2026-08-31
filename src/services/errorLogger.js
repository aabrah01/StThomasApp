/**
 * Reports client errors to the client_errors table so the office can see why a
 * member's app failed, instead of only the friendly message the member read.
 *
 * Fire-and-forget by design, and the same shape as notifySignup in
 * databaseService: the caller has already handled the failure and returned its
 * user-facing string, so a logging failure must never turn into a second error.
 *
 * Only writes with a session — the insert policy requires auth.uid(), so a
 * signed-out call would be rejected. Sign-in failures are not covered here (see
 * the migration comment).
 */
import { supabase } from '../../supabase.config';
import { isDemoSession } from '../utils/config';
import { buildInfo } from '../utils/buildInfo';

const MAX_MESSAGE = 500;

// Pulls the cause out of the shapes actually thrown in this app: axios errors
// (documents, calendar, youtube) and Supabase errors (database, storage).
const describe = (error) => {
  if (!error) return { message: 'Unknown error' };

  const message =
    error?.response?.data?.error?.message ??
    error?.message ??
    String(error);

  const status = error?.response?.status ?? error?.status ?? null;
  const code = error?.code ?? null;

  return {
    message: message.slice(0, MAX_MESSAGE),
    status,
    code,
  };
};

export const logClientError = async (operation, error, context = {}) => {
  if (isDemoSession() || !supabase) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { message, status, code } = describe(error);

    await supabase.from('client_errors').insert({
      user_id: session.user.id,
      ...buildInfo(),
      operation,
      message,
      context: { ...context, ...(status && { status }), ...(code && { code }) },
    });
  } catch (err) {
    // Logging the logger would be circular; the console is enough in dev.
    console.warn('[error log] not sent:', err);
  }
};
