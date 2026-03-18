import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../firebase.config';
import { COLLECTIONS } from '../utils/constants';
import { DEMO_MODE } from '../utils/config';
import {
  demoFamilies,
  demoMembers,
  demoUserRole,
  demoAppSettings,
} from '../utils/demoData';

class FirestoreService {
  async getAllFamilies() {
    // Demo mode: Return mock data
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
      const families = demoFamilies.filter(f => f.isActive).sort((a, b) =>
        a.familyName.localeCompare(b.familyName)
      );
      return { data: families, error: null };
    }

    // Real Firebase query
    try {
      const familiesRef = collection(db, COLLECTIONS.FAMILIES);
      const q = query(
        familiesRef,
        where('isActive', '==', true),
        orderBy('familyName', 'asc')
      );
      const querySnapshot = await getDocs(q);
      const families = [];
      querySnapshot.forEach((doc) => {
        families.push({ id: doc.id, ...doc.data() });
      });
      return { data: families, error: null };
    } catch (error) {
      console.error('Error fetching families:', error);
      return { data: null, error: error.message };
    }
  }

  async getFamilyById(familyId) {
    // Demo mode: Return mock data
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 200)); // Simulate network delay
      const family = demoFamilies.find(f => f.id === familyId);
      if (family) {
        return { data: family, error: null };
      } else {
        return { data: null, error: 'Family not found' };
      }
    }

    // Real Firebase query
    try {
      const familyRef = doc(db, COLLECTIONS.FAMILIES, familyId);
      const familyDoc = await getDoc(familyRef);
      if (familyDoc.exists()) {
        return { data: { id: familyDoc.id, ...familyDoc.data() }, error: null };
      } else {
        return { data: null, error: 'Family not found' };
      }
    } catch (error) {
      console.error('Error fetching family:', error);
      return { data: null, error: error.message };
    }
  }

  async getMembersByFamilyId(familyId) {
    // Demo mode: Return mock data
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 200)); // Simulate network delay
      const members = demoMembers.filter(m => m.familyId === familyId && m.isActive);
      return { data: members, error: null };
    }

    // Real Firebase query
    try {
      const membersRef = collection(db, COLLECTIONS.MEMBERS);
      const q = query(
        membersRef,
        where('familyId', '==', familyId),
        where('isActive', '==', true)
      );
      const querySnapshot = await getDocs(q);
      const members = [];
      querySnapshot.forEach((doc) => {
        members.push({ id: doc.id, ...doc.data() });
      });
      return { data: members, error: null };
    } catch (error) {
      console.error('Error fetching members:', error);
      return { data: null, error: error.message };
    }
  }

  async getMemberByUserId(userId) {
    // Demo mode: Return mock data
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 200)); // Simulate network delay
      const member = demoMembers.find(m => m.userId === userId);
      if (member) {
        return { data: member, error: null };
      } else {
        return { data: null, error: 'Member not found' };
      }
    }

    // Real Firebase query
    try {
      const membersRef = collection(db, COLLECTIONS.MEMBERS);
      const q = query(membersRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const memberDoc = querySnapshot.docs[0];
        return { data: { id: memberDoc.id, ...memberDoc.data() }, error: null };
      } else {
        return { data: null, error: 'Member not found' };
      }
    } catch (error) {
      console.error('Error fetching member:', error);
      return { data: null, error: error.message };
    }
  }

  async getUserRole(userId) {
    // Demo mode: Return mock data
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 200)); // Simulate network delay
      return { data: demoUserRole, error: null };
    }

    // Real Firebase query
    try {
      const roleRef = doc(db, COLLECTIONS.USER_ROLES, userId);
      const roleDoc = await getDoc(roleRef);
      if (roleDoc.exists()) {
        return { data: roleDoc.data(), error: null };
      } else {
        return { data: null, error: 'User role not found' };
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
      return { data: null, error: error.message };
    }
  }

  async getAppSettings() {
    // Demo mode: Return mock data
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 200)); // Simulate network delay
      return { data: demoAppSettings, error: null };
    }

    // Real Firebase query
    try {
      const settingsRef = doc(db, COLLECTIONS.APP_SETTINGS, 'config');
      const settingsDoc = await getDoc(settingsRef);
      if (settingsDoc.exists()) {
        return { data: settingsDoc.data(), error: null };
      } else {
        return { data: null, error: 'App settings not found' };
      }
    } catch (error) {
      console.error('Error fetching app settings:', error);
      return { data: null, error: error.message };
    }
  }
}

export default new FirestoreService();
