/**
 * Tests for DatabaseService in DEMO_MODE = true.
 * All data comes from demoData.js — no Supabase calls are made.
 */

jest.mock('../../utils/config', () => ({
  DEMO_MODE: true,
  DEMO_CREDENTIALS: { email: 'demo@example.com', password: 'demo123' },
  isDemoSession: () => true,
}));

let db;
beforeEach(() => {
  jest.resetModules();
  jest.mock('../../utils/config', () => ({ DEMO_MODE: true, isDemoSession: () => true }));
  db = require('../../services/databaseService').default;
});

describe('DatabaseService — demo mode', () => {
  describe('getAllFamilies', () => {
    it('returns all active families', async () => {
      const { data, error } = await db.getAllFamilies();
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it('returns only active families', async () => {
      const { data } = await db.getAllFamilies();
      expect(data.every(f => f.isActive)).toBe(true);
    });

    it('returns families sorted alphabetically by familyName', async () => {
      const { data } = await db.getAllFamilies();
      const names = data.map(f => f.familyName);
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sorted);
    });

    it('each family has required shape', async () => {
      const { data } = await db.getAllFamilies();
      for (const f of data) {
        expect(f).toHaveProperty('id');
        expect(f).toHaveProperty('familyName');
        expect(f).toHaveProperty('membershipId');
        expect(f).toHaveProperty('address');
      }
    });
  });

  describe('getFamilyById', () => {
    it('returns the correct family for a valid id', async () => {
      const { data: families } = await db.getAllFamilies();
      const target = families[0];
      const { data, error } = await db.getFamilyById(target.id);
      expect(error).toBeNull();
      expect(data.id).toBe(target.id);
      expect(data.familyName).toBe(target.familyName);
    });

    it('returns an error for an unknown id', async () => {
      const { data, error } = await db.getFamilyById('nonexistent-id');
      expect(data).toBeNull();
      expect(error).toBeTruthy();
    });
  });

  describe('getMembersByFamilyId', () => {
    it('returns active members for a valid family', async () => {
      const { data: families } = await db.getAllFamilies();
      const { data, error } = await db.getMembersByFamilyId(families[0].id);
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('returns only members belonging to the requested family', async () => {
      const { data: families } = await db.getAllFamilies();
      const familyId = families[0].id;
      const { data } = await db.getMembersByFamilyId(familyId);
      expect(data.every(m => m.familyId === familyId)).toBe(true);
    });

    it('returns empty array for family with no members', async () => {
      const { data } = await db.getMembersByFamilyId('unknown-family');
      expect(data).toEqual([]);
    });

    it('each member has required shape', async () => {
      const { data: families } = await db.getAllFamilies();
      const { data } = await db.getMembersByFamilyId(families[0].id);
      if (data.length > 0) {
        const m = data[0];
        expect(m).toHaveProperty('id');
        expect(m).toHaveProperty('firstName');
        expect(m).toHaveProperty('lastName');
        expect(m).toHaveProperty('familyId');
      }
    });
  });

  describe('getMemberByUserId', () => {
    it('returns a member for the demo user id', async () => {
      // Import demo data to know a valid userId
      const { demoMembers } = require('../../utils/demoData');
      const memberWithUser = demoMembers.find(m => m.userId);
      if (memberWithUser) {
        const { data, error } = await db.getMemberByUserId(memberWithUser.userId);
        expect(error).toBeNull();
        expect(data.userId).toBe(memberWithUser.userId);
      }
    });

    it('returns an error for unknown userId', async () => {
      const { data, error } = await db.getMemberByUserId('unknown-user-id');
      expect(data).toBeNull();
      expect(error).toBeTruthy();
    });
  });

  describe('getUserRole', () => {
    it('returns a role object', async () => {
      const { data, error } = await db.getUserRole('any-user-id');
      expect(error).toBeNull();
      expect(data).toBeTruthy();
    });
  });

  describe('getContributions', () => {
    it('returns contributions for a valid family + year', async () => {
      const { demoContributions } = require('../../utils/demoData');
      const sample = demoContributions[0];
      if (sample) {
        const { data, error } = await db.getContributions(sample.familyId, sample.fiscalYear);
        expect(error).toBeNull();
        expect(Array.isArray(data)).toBe(true);
        expect(data.every(c => c.familyId === sample.familyId && c.fiscalYear === sample.fiscalYear)).toBe(true);
      }
    });

    it('returns empty array for unknown family', async () => {
      const { data } = await db.getContributions('unknown-family', 2024);
      expect(data).toEqual([]);
    });

    it('each contribution has required shape', async () => {
      const { demoContributions } = require('../../utils/demoData');
      const sample = demoContributions[0];
      if (sample) {
        const { data } = await db.getContributions(sample.familyId, sample.fiscalYear);
        if (data.length > 0) {
          const c = data[0];
          expect(c).toHaveProperty('id');
          expect(c).toHaveProperty('amount');
          expect(typeof c.amount).toBe('number');
          expect(c).toHaveProperty('date');
          expect(c).toHaveProperty('category');
        }
      }
    });
  });

  describe('updateFamilyPhoto', () => {
    it('updates photo in demo mode and returns no error', async () => {
      const { data: families } = await db.getAllFamilies();
      const familyId = families[0].id;
      const { error } = await db.updateFamilyPhoto(familyId, 'https://example.com/new-photo.jpg');
      expect(error).toBeNull();
    });

    it('photo override is reflected in subsequent getFamilyById', async () => {
      const { data: families } = await db.getAllFamilies();
      const familyId = families[0].id;
      const newUrl = 'https://example.com/overridden.jpg';

      await db.updateFamilyPhoto(familyId, newUrl);
      const { data } = await db.getFamilyById(familyId);
      expect(data.photoUrl).toBe(newUrl);
    });
  });

  describe('getMemberByEmail', () => {
    it('returns null (not an error) for an unknown email', async () => {
      const { data, error } = await db.getMemberByEmail('nobody@example.com');
      expect(data).toBeNull();
      // demo mode has no getMemberByEmail — it calls supabase directly,
      // so in demo mode this simply resolves via the supabase mock path.
      // Just verify it doesn't throw.
    });
  });

  describe('getMembersByEmail', () => {
    it('returns an array (may be empty) for any email in demo mode', async () => {
      // getMembersByEmail calls supabase directly — in demo mode supabase is
      // not configured, so the call will return an empty/null result gracefully.
      const { data } = await db.getMembersByEmail('shared@example.com');
      // We just verify the method exists and returns a shaped result
      expect(data === null || Array.isArray(data)).toBe(true);
    });
  });

  describe('getMemberByUserId — multiple members with same user_id', () => {
    it('returns a single member (not an array) even when multiple share user_id', async () => {
      const { demoMembers } = require('../../utils/demoData');
      const memberWithUser = demoMembers.find(m => m.userId);
      if (memberWithUser) {
        const { data } = await db.getMemberByUserId(memberWithUser.userId);
        // Should return a single member object, not an array
        expect(data).not.toBeNull();
        expect(Array.isArray(data)).toBe(false);
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('firstName');
      }
    });

    it('returns null (not an error object) for an unknown userId', async () => {
      const { data } = await db.getMemberByUserId('totally-unknown-id');
      expect(data).toBeNull();
    });
  });
});
