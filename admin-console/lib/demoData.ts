import type { Family, Member, Document, Contribution } from './types';

export const DEMO_FAMILIES: Family[] = [
  { id: 'family1', familyName: 'Johnson Family',  membershipId: 'MEM001', email: 'johnson@example.com',  phone: '(555) 123-4567', address: '123 Oak Street, Springfield, IL 62701',  photoUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=600&q=80' },
  { id: 'family2', familyName: 'Williams Family', membershipId: 'MEM002', email: 'williams@example.com', phone: '(555) 234-5678', address: '456 Maple Avenue, Springfield, IL 62702', photoUrl: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=600&q=80' },
  { id: 'family3', familyName: 'Anderson Family', membershipId: 'MEM003', email: 'anderson@example.com', phone: '(555) 345-6789', address: '789 Pine Road, Springfield, IL 62703',     photoUrl: '' },
  { id: 'family4', familyName: 'Martinez Family', membershipId: 'MEM004', email: 'martinez@example.com', phone: '(555) 456-7890', address: '321 Elm Street, Springfield, IL 62704',     photoUrl: '' },
  { id: 'family5', familyName: 'Davis Family',    membershipId: 'MEM005', email: 'davis@example.com',    phone: '(555) 567-8901', address: '654 Birch Lane, Springfield, IL 62705',      photoUrl: '' },
];

export const DEMO_MEMBERS: Member[] = [
  { id: 'member1', familyId: 'family1', firstName: 'John',     lastName: 'Johnson',  role: 'parent', email: 'john.johnson@example.com',     phoneNumber: '(555) 123-4567', photoUrl: '', isHeadOfHousehold: true  },
  { id: 'member2', familyId: 'family1', firstName: 'Sarah',    lastName: 'Johnson',  role: 'parent', email: 'sarah.johnson@example.com',    phoneNumber: '(555) 123-4567', photoUrl: '', isHeadOfHousehold: false },
  { id: 'member3', familyId: 'family1', firstName: 'Emma',     lastName: 'Johnson',  role: 'child',  email: '',                             phoneNumber: '',               photoUrl: '', isHeadOfHousehold: false },
  { id: 'member4', familyId: 'family2', firstName: 'Michael',  lastName: 'Williams', role: 'parent', email: 'michael.williams@example.com', phoneNumber: '(555) 234-5678', photoUrl: '', isHeadOfHousehold: true  },
  { id: 'member5', familyId: 'family2', firstName: 'Jennifer', lastName: 'Williams', role: 'parent', email: 'jennifer.williams@example.com',phoneNumber: '(555) 234-5678', photoUrl: '', isHeadOfHousehold: false },
  { id: 'member6', familyId: 'family3', firstName: 'David',    lastName: 'Anderson', role: 'parent', email: 'david.anderson@example.com',   phoneNumber: '(555) 345-6789', photoUrl: '', isHeadOfHousehold: true  },
  { id: 'member7', familyId: 'family3', firstName: 'Lisa',     lastName: 'Anderson', role: 'parent', email: 'lisa.anderson@example.com',    phoneNumber: '(555) 345-6789', photoUrl: '', isHeadOfHousehold: false },
  { id: 'member8', familyId: 'family4', firstName: 'Carlos',   lastName: 'Martinez', role: 'parent', email: 'carlos.martinez@example.com',  phoneNumber: '(555) 456-7890', photoUrl: '', isHeadOfHousehold: true  },
  { id: 'member9', familyId: 'family5', firstName: 'Robert',   lastName: 'Davis',    role: 'parent', email: 'robert.davis@example.com',     phoneNumber: '(555) 567-8901', photoUrl: '', isHeadOfHousehold: true  },
];

export const DEMO_DOCUMENTS: Document[] = [
  { id: 'doc1', title: '2026 Charitable Contribution Letter', type: 'tax-letter',    url: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/sample.pdf', year: 2026, createdAt: '2026-01-15T10:00:00Z' },
  { id: 'doc2', title: '2026 Annual Parish Report',           type: 'annual-report', url: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/sample.pdf', year: 2026, createdAt: '2026-02-01T10:00:00Z' },
  { id: 'doc3', title: '2026 Stewardship Pledge Receipt',     type: 'receipt',       url: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/sample.pdf', year: 2026, createdAt: '2026-01-10T10:00:00Z' },
];

export const DEMO_CONTRIBUTIONS: (Contribution & { familyName: string })[] = [
  { id: 'contrib-1', familyId: 'family1', familyName: 'Johnson Family',  date: '2026-01-12', amount: 500.00, category: 'Tithe',             fiscalYear: 2026 },
  { id: 'contrib-2', familyId: 'family1', familyName: 'Johnson Family',  date: '2026-02-09', amount: 500.00, category: 'Tithe',             fiscalYear: 2026 },
  { id: 'contrib-3', familyId: 'family1', familyName: 'Johnson Family',  date: '2026-03-08', amount: 500.00, category: 'Tithe',             fiscalYear: 2026 },
  { id: 'contrib-4', familyId: 'family1', familyName: 'Johnson Family',  date: '2026-01-01', amount: 250.00, category: 'Building Fund',     fiscalYear: 2026 },
  { id: 'contrib-5', familyId: 'family1', familyName: 'Johnson Family',  date: '2026-02-22', amount: 100.00, category: 'Lenten Collection', fiscalYear: 2026 },
  { id: 'contrib-6', familyId: 'family1', familyName: 'Johnson Family',  date: '2026-03-15', amount:  75.00, category: 'Outreach',          fiscalYear: 2026 },
  { id: 'contrib-7', familyId: 'family2', familyName: 'Williams Family', date: '2026-01-18', amount: 400.00, category: 'Tithe',             fiscalYear: 2026 },
  { id: 'contrib-8', familyId: 'family2', familyName: 'Williams Family', date: '2026-02-15', amount: 400.00, category: 'Tithe',             fiscalYear: 2026 },
  { id: 'contrib-9', familyId: 'family3', familyName: 'Anderson Family', date: '2026-01-20', amount: 300.00, category: 'Tithe',             fiscalYear: 2026 },
];

export const DEMO_USERS = [
  { id: 'user1', email: 'admin@stthomas.org',    role: 'admin',  lastSignIn: '2026-03-24T10:00:00Z' },
  { id: 'user2', email: 'john.johnson@example.com', role: 'member', lastSignIn: '2026-03-20T09:00:00Z' },
];
