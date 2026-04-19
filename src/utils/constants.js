export const COLLECTIONS = {
  FAMILIES: 'families',
  MEMBERS: 'members',
  USER_ROLES: 'userRoles',
  APP_SETTINGS: 'appSettings',
};

export const USER_ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
};

export const MEMBER_ROLES = {
  PARENT: 'parent',
  CHILD: 'child',
  GUARDIAN: 'guardian',
};

export const STORAGE_KEYS = {
  CALENDAR_EVENTS: '@st_thomas_calendar_events',
  LAST_SYNC: '@st_thomas_last_sync',
  YOUTUBE_VIDEOS: '@st_thomas_youtube_videos',
  YOUTUBE_LAST_SYNC: '@st_thomas_youtube_last_sync',
};

export const ERROR_MESSAGES = {
  AUTH_FAILED: 'Authentication failed. Please check your credentials.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  GENERIC_ERROR: 'An error occurred. Please try again.',
  NO_DATA: 'No data available.',
};

export const SUCCESS_MESSAGES = {
  PASSWORD_RESET_SENT: 'Password reset email sent. Please check your inbox.',
  LOGOUT_SUCCESS: 'Successfully logged out.',
};
