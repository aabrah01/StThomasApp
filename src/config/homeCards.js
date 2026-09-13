// Home screen menu cards.
//
// Adding a destination is one entry here plus a screen registration in
// AppNavigator — no layout changes. `target` is a screen name: sibling tabs and
// parent-stack screens are both reached with navigation.navigate(name).
//
// flag: key(s) on appSettings — the card shows if ANY is true. Omit for always-on.
export const HOME_CARDS = [
  {
    key: 'directory',
    label: 'Directory',
    sublabel: 'Find a member',
    icon: 'people-outline',
    target: 'Directory',
  },
  {
    key: 'giving',
    label: 'My Giving',
    sublabel: 'Year To Date Giving',
    icon: 'heart-outline',
    target: 'Giving',
  },
  {
    key: 'events',
    label: 'Events',
    sublabel: 'Parish calendar',
    icon: 'calendar-outline',
    target: 'Events',
  },
  {
    key: 'signups',
    // Label narrows when only one kind of sign-up is switched on
    label: (s) =>
      s?.enableMealSignup && s?.enableFlowerSignup
        ? 'Sign-Ups'
        : s?.enableMealSignup ? 'Food Sign-Up' : 'Flower Sign-Up',
    sublabel: (s) =>
      s?.enableMealSignup && s?.enableFlowerSignup
        ? 'Food and flowers'
        : 'Liturgy days',
    icon: 'restaurant-outline',
    flag: ['enableMealSignup', 'enableFlowerSignup'],
    target: 'Signups',
  },
  {
    key: 'documents',
    label: 'Documents',
    sublabel: 'Parish assembly',
    icon: 'document-text-outline',
    flag: ['enableDocuments'],
    target: 'Documents',
  },
  {
    key: 'contact',
    label: 'Administration',
    sublabel: 'Staff and clergy',
    icon: 'call-outline',
    target: 'Contact',
  },
  {
    key: 'photos',
    label: 'Photos',
    sublabel: 'Parish albums',
    icon: 'images-outline',
    flag: ['enablePhotos'],
    target: 'Photos',
  },
  {
    key: 'media',
    label: 'Media',
    // Generic on purpose — YouTube is the only source today, not necessarily the only one
    sublabel: 'Homilies and services',
    icon: 'play-circle-outline',
    target: 'Media',
  },
];

const resolve = (value, appSettings) =>
  typeof value === 'function' ? value(appSettings) : value;

export const visibleCards = (cards, appSettings) =>
  cards
    .filter(card => !card.flag || card.flag.some(key => appSettings?.[key]))
    .map(card => ({
      ...card,
      label: resolve(card.label, appSettings),
      sublabel: resolve(card.sublabel, appSettings),
    }));
