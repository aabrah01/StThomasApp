/**
 * Which build of the app this is — reported alongside client errors and written
 * to client_installs on every auth event (cold start, sign-in, token refresh),
 * so the console can show it per member.
 *
 * react-native and the expo modules are required lazily rather than imported at
 * the top: this is reached from databaseService, which the test suite loads in a
 * plain jest environment with no expo preset, and a top-level `react-native`
 * import breaks those tests on `__DEV__ is not defined`. Callers guard on the
 * demo session first, so tests never reach the require.
 *
 * Keys are snake_case because both tables take these columns verbatim.
 */
export const buildInfo = () => {
  const { Platform } = require('react-native');
  const Application = require('expo-application');
  const Updates = require('expo-updates');

  return {
    // The native binary's version, the same value ProfileScreen shows the member
    // — so what the console displays matches what they read off their own screen
    // during a support call. Constants.expoConfig.version is the manifest's
    // version instead, which drifts from the installed binary (a dev build
    // compiled at 1.0.7 is served the current app.json, so it reports 1.1.0).
    // The OTA bundle riding on top of it is update_id, below.
    app_version: Application.nativeApplicationVersion ?? null,
    update_id: Updates.updateId ?? null,
    // Orders the OTA bundles — update_id is a UUID and sorts meaninglessly.
    update_created_at: Updates.createdAt?.toISOString() ?? null,
    platform: Platform.OS,
    os_version: String(Platform.Version),
  };
};

/**
 * Stable id for this device, so a member's phone and tablet are separate rows.
 *
 * Uses expo-application, which is already a dependency and therefore already in
 * the shipped binary — expo-device would give model names but is a new native
 * module, and adding it would force a store build instead of an OTA update.
 *
 * Both ids are scoped to this publisher and reset on reinstall, which shows up
 * as a new device. Returns null if neither is available, and the caller skips
 * reporting rather than collapsing every such install onto one shared row.
 */
export const getDeviceId = async () => {
  const { Platform } = require('react-native');
  const Application = require('expo-application');

  if (Platform.OS === 'ios') return await Application.getIosIdForVendorAsync();
  if (Platform.OS === 'android') return Application.getAndroidId();
  return null;
};
