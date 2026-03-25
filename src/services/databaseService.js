/**
 * Database service — backed by Supabase (PostgreSQL).
 *
 * Column mapping: Supabase uses snake_case; the app uses camelCase.
 * All mapFamily/mapMember/etc. helpers convert between the two so the
 * rest of the app code (and demo data) stays unchanged.
 */
import { supabase } from '../../supabase.config';
import { DEMO_MODE } from '../utils/config';
import {
  demoFamilies,
  demoMembers,
  demoUserRole,
  demoAppSettings,
  demoDocuments,
  demoContributions,
} from '../utils/demoData';

// In-memory photo overrides for demo mode
const demoPhotoOverrides = {};

// ── Row mappers ───────────────────────────────────────────────────────────────

const mapFamily = (row) => ({
  id: row.id,
  familyName: row.family_name,
  membershipId: row.membership_id,
  address: {
    street: row.address,
    city: row.city,
    state: row.state,
    zipCode: row.zip,
  },
  phoneNumber: row.phone,
  email: row.email,
  photoUrl: row.photo_url,
  isActive: row.is_active,
});

const mapMember = (row) => ({
  id: row.id,
  familyId: row.family_id,
  userId: row.user_id,
  firstName: row.first_name,
  lastName: row.last_name,
  email: row.email,
  phoneNumber: row.phone_number,
  role: row.role,
  isHeadOfHousehold: row.is_head_of_household ?? false,
  isActive: row.is_active,
  photoUrl: row.photo_url,
});

const mapDocument = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  type: row.type,
  year: row.year,
  url: row.url,
  uploadedAt: row.uploaded_at,
});

const mapContribution = (row) => ({
  id: row.id,
  familyId: row.family_id,
  amount: parseFloat(row.amount),
  date: row.date,
  category: row.category,
  description: row.description,
  fiscalYear: row.fiscal_year,
});

// ── Service ───────────────────────────────────────────────────────────────────

class DatabaseService {
  updateDemoPhoto(familyId, photoUrl) {
    demoPhotoOverrides[familyId] = photoUrl;
  }

  async updateFamilyPhoto(familyId, photoUrl) {
    if (DEMO_MODE) {
      demoPhotoOverrides[familyId] = photoUrl;
      return { error: null };
    }
    const { error } = await supabase
      .from('families')
      .update({ photo_url: photoUrl })
      .eq('id', familyId);
    return { error: error?.message || null };
  }

  async getAllFamilies() {
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const families = demoFamilies
        .filter(f => f.isActive)
        .sort((a, b) => a.familyName.localeCompare(b.familyName))
        .map(f => ({ ...f, photoUrl: demoPhotoOverrides[f.id] || f.photoUrl }));
      return { data: families, error: null };
    }

    const { data, error } = await supabase
      .from('families')
      .select('*')
      .eq('is_active', true)
      .order('family_name', { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data: data.map(mapFamily), error: null };
  }

  async getFamilyById(familyId) {
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const family = demoFamilies.find(f => f.id === familyId);
      if (!family) return { data: null, error: 'Family not found' };
      return {
        data: { ...family, photoUrl: demoPhotoOverrides[family.id] || family.photoUrl },
        error: null,
      };
    }

    const { data, error } = await supabase
      .from('families')
      .select('*')
      .eq('id', familyId)
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapFamily(data), error: null };
  }

  async getMembersByFamilyId(familyId) {
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const members = demoMembers.filter(m => m.familyId === familyId && m.isActive);
      return { data: members, error: null };
    }

    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('family_id', familyId)
      .eq('is_active', true);

    if (error) return { data: null, error: error.message };
    return { data: data.map(mapMember), error: null };
  }

  async getMemberByUserId(userId) {
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const member = demoMembers.find(m => m.userId === userId);
      if (!member) return { data: null, error: 'Member not found' };
      return { data: member, error: null };
    }

    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapMember(data), error: null };
  }

  async getUserRole(userId) {
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { data: demoUserRole, error: null };
    }

    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  }

  async getDocuments(year) {
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const docs = demoDocuments.filter(d => d.year === year);
      return { data: docs, error: null };
    }

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('year', year)
      .order('uploaded_at', { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: data.map(mapDocument), error: null };
  }

  /**
   * Get YTD contributions for a family.
   *
   * QuickBooks Desktop sync options:
   *   A) Manual CSV import — export "Transaction Detail by Account" from QB Desktop,
   *      then import to Supabase via the dashboard Table Editor or a SQL COPY command.
   *   B) QuickBooks Web Connector (QBWC) — a Windows service that can push QB data
   *      to a web endpoint on a schedule. Pair with a Supabase Edge Function to receive it.
   *   C) Third-party ETL (Skyvia, Coupler.io) — connects to QB Desktop via ODBC
   *      and syncs automatically to Supabase.
   *
   * The contributions table schema is in /supabase/schema.sql.
   */
  async getContributions(familyId, year) {
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const contributions = demoContributions.filter(
        c => c.familyId === familyId && c.fiscalYear === year
      );
      return { data: contributions, error: null };
    }

    const { data, error } = await supabase
      .from('contributions')
      .select('*')
      .eq('family_id', familyId)
      .eq('fiscal_year', year)
      .order('date', { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: data.map(mapContribution), error: null };
  }

  async getAppSettings() {
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { data: demoAppSettings, error: null };
    }

    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 'config')
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  }
}

export default new DatabaseService();
