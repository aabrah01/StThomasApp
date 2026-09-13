/**
 * Fetches a pending OTA update when the app returns to the foreground, and
 * offers to restart into it.
 *
 * The fetch is the point, and it is silent. expo-updates checks only on cold
 * start — `checkAutomatically` is left at its default of ON_LOAD — so a member
 * who never fully quits the app, which is the normal case on iOS where an app
 * can sit in the background for weeks, never downloads an update at all. Those
 * members are stuck on whatever bundle they first installed, indefinitely.
 *
 * The prompt only accelerates. Declining costs nothing: by then the bundle is
 * already on disk, so it launches at the next cold start exactly as it would
 * have without this hook.
 *
 * Not folded into useAppRefresh — that hook hands four screens a counter that
 * ticks on every foreground, which is the wrong shape for a once-per-update
 * network call, and widening its contract would change behaviour for all four.
 */
import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import * as Updates from 'expo-updates';
import { logClientError } from '../services/errorLogger';

export const useUpdatePrompt = () => {
  const wasBackgrounded = useRef(false);
  const checking = useRef(false);
  const declinedId = useRef(null);

  useEffect(() => {
    // False in Expo Go and development builds, where there is no update to
    // fetch and these calls throw rather than no-opping.
    if (!Updates.isEnabled) return undefined;

    const check = async () => {
      // A slow check must not stack up behind repeated foregrounding.
      if (checking.current) return;
      checking.current = true;

      try {
        const result = await Updates.checkForUpdateAsync();
        // isAvailable is false for a roll-back-to-embedded result too, which is
        // not something to prompt about.
        if (!result.isAvailable) return;

        const id = result.manifest?.id ?? null;
        if (id && id === declinedId.current) return;

        // Download before asking, so "Restart" reloads at once instead of
        // sitting on a spinner — and so a fetch that fails halfway never
        // announces an update that isn't actually there.
        const fetched = await Updates.fetchUpdateAsync();
        if (!fetched.isNew) return;

        Alert.alert(
          'Update Available',
          'A new version of the app is ready. Restart now to use it?',
          [
            {
              text: 'Later',
              style: 'cancel',
              // Remember this one so returning to the app every few minutes
              // does not ask again. A genuinely newer bundle has a different
              // id and will still prompt.
              onPress: () => { declinedId.current = id; },
            },
            {
              text: 'Restart',
              onPress: () => {
                Updates.reloadAsync().catch((err) => logClientError('updates.reload', err));
              },
            },
          ]
        );
      } catch (err) {
        // Fire-and-forget, the same shape as notifySignup: a member who cannot
        // reach the update server should see nothing at all, not an error.
        logClientError('updates.check', err);
      } finally {
        checking.current = false;
      }
    };

    const subscription = AppState.addEventListener('change', (nextState) => {
      // Only a real return from the background earns a network round trip.
      // Comparing against the previous state is not enough: iOS reports a
      // genuine return as background -> inactive -> active, but also reports
      // dismissing the control centre or a permission sheet as active ->
      // inactive -> active, and those two are indistinguishable at the moment
      // 'active' arrives. Latching on 'background' tells them apart.
      //
      // Cold starts are deliberately not handled here — ON_LOAD already covers
      // those, and this hook exists for the members who never cold start.
      if (nextState === 'background') wasBackgrounded.current = true;

      if (nextState === 'active' && wasBackgrounded.current) {
        wasBackgrounded.current = false;
        check();
      }
    });

    return () => subscription.remove();
  }, []);
};
