import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from '../../supabase.config';

const ADMIN_CONSOLE_URL = process.env.EXPO_PUBLIC_ADMIN_CONSOLE_URL;

export async function generateAndShareStatement(familyId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not signed in.');
  }

  const res = await fetch(`${ADMIN_CONSOLE_URL}/api/families/${familyId}/statement`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to generate statement (${res.status}).`);
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  const file = new File(Paths.cache, `statement-${familyId}-${Date.now()}.pdf`);
  file.create();
  file.write(bytes);

  if (await Sharing.isAvailableAsync()) {
    // Not awaited: on iOS, shareAsync's promise can hang indefinitely if the user
    // dismisses the share sheet without picking an action, which would leave the
    // caller's loading state stuck forever. The PDF is already generated and ready
    // by this point, so the caller doesn't need to wait for the sheet to close.
    Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Giving Statement' }).catch(() => {});
  }
}
