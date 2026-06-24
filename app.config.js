// Dynamic Expo config: adds a ".dev" app variant so the development build can be
// installed alongside the production (App Store) app, each with its own icon.
//
// app.json holds the production base config and is passed in as `config`.
// When APP_VARIANT=development (set by the EAS "development" profile, or on the
// CLI for local builds), the bundle id / package / name are suffixed so the OS
// treats it as a separate app. Production builds leave APP_VARIANT unset and
// fall through to the real identifiers untouched.

const IS_DEV = process.env.APP_VARIANT === 'development';

export default ({ config }) => ({
  ...config,
  name: IS_DEV ? `${config.name} (Dev)` : config.name,
  // iOS uses the top-level icon; swap in the DEV-badged version for the variant.
  icon: IS_DEV ? './assets/icon-dev.png' : config.icon,
  ios: {
    ...config.ios,
    bundleIdentifier: IS_DEV ? `${config.ios.bundleIdentifier}.dev` : config.ios.bundleIdentifier,
  },
  android: {
    ...config.android,
    package: IS_DEV ? `${config.android.package}.dev` : config.android.package,
    icon: IS_DEV ? './assets/android_legacy_icon-dev.png' : config.android.icon,
    adaptiveIcon: {
      ...config.android.adaptiveIcon,
      foregroundImage: IS_DEV
        ? './assets/adaptive_foreground-dev.png'
        : config.android.adaptiveIcon.foregroundImage,
    },
  },
});
