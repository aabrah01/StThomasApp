export interface Family {
  id: string;
  familyName: string;
  membershipId: string;
  email?: string;
  phone?: string;
  address?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  photoUrl?: string;
}

export interface Member {
  id: string;
  familyId: string;
  firstName: string;
  lastName: string;
  role?: string;
  email?: string;
  phoneNumber?: string;
  photoUrl?: string;
  isHeadOfHousehold: boolean;
}


export interface Contribution {
  id: string;
  familyId: string;
  date: string;
  amount: number;
  category: string;
  description?: string;
  fiscalYear: number;
}

// 'full' — the member is covering the service alone, which closes it to other
// sign-ups. 'shared' — they are splitting it. null on pledges made before the
// app asked.
export type PledgeType = 'full' | 'shared' | null;

// Food or flowers — the two sign-up tables have the same shape.
export type SignupKind = 'meal' | 'flower';

// A pledge is a member's, or a well-wisher's entered by name (donorName) —
// never both.
export interface Signup {
  id: string;
  eventDate: string;
  eventId: string | null;
  memberId: string | null;
  memberName: string | null;
  membershipId: string | null;
  familyName: string | null;
  donorName: string | null;
  pledgeType: PledgeType;
  createdAt: string;
}

// A timed Divine Liturgy on the parish calendar — what pledges are made for.
export interface Service {
  eventId: string;
  date: string;         // YYYY-MM-DD, parish time
  title: string;
  startsAt: string;     // ISO date-time
}

// For picking who a pledge is for.
export interface MemberOption {
  id: string;
  name: string;
  membershipId: string | null;
  familyName: string | null;
}

export interface UserRole {
  id: string;
  userId: string;
  role: 'admin' | 'member';
  email?: string;
}

export interface ClientError {
  id: string;
  email: string;
  memberName: string | null;
  appVersion: string | null;
  updateId: string | null;
  platform: string | null;
  osVersion: string | null;
  operation: string;
  message: string;
  context: Record<string, unknown> | null;
  createdAt: string;
}
