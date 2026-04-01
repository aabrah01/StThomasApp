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

export interface UserRole {
  id: string;
  userId: string;
  role: 'admin' | 'member';
  email?: string;
}
