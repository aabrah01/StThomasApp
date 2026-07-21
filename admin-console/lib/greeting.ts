interface GreetingMember {
  firstName: string;
  lastName: string;
  isHeadOfHousehold: boolean;
}

/** Builds a default statement salutation from a family's head-of-household member(s). */
export function buildGreeting(members: GreetingMember[], familyName: string): string {
  const heads = members.filter(m => m.isHeadOfHousehold);
  if (heads.length === 0) return `Dear ${familyName} Family,`;

  const lastNames = new Set(heads.map(h => h.lastName));
  if (heads.length === 1 || lastNames.size > 1) {
    return `Dear ${heads.map(h => `${h.firstName} ${h.lastName}`).join(' and ')},`;
  }

  const firstNames = heads.map(h => h.firstName);
  const joined = firstNames.length === 2
    ? firstNames.join(' and ')
    : `${firstNames.slice(0, -1).join(', ')}, and ${firstNames[firstNames.length - 1]}`;
  return `Dear ${joined} ${heads[0].lastName},`;
}
