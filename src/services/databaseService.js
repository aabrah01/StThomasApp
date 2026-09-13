/**
 * Database service — backed by Supabase (PostgreSQL).
 *
 * Column mapping: Supabase uses snake_case; the app uses camelCase.
 * All mapFamily/mapMember/etc. helpers convert between the two so the
 * rest of the app code (and demo data) stays unchanged.
 */
import { supabase } from '../../supabase.config';
import { isDemoSession } from '../utils/config';
import { logClientError } from './errorLogger';
import { buildInfo, getDeviceId } from '../utils/buildInfo';
import {
  demoFamilies,
  demoMembers,
  demoUserRole,
  demoAppSettings,
  demoChurchContacts,
  demoContributions,
  demoContributionCategoryAmounts,
} from '../utils/demoData';

// In-memory photo overrides for demo mode
const demoPhotoOverrides = {};

// In-memory meal signup store for demo mode
const demoMealSignups = [];

// In-memory flower signup store for demo mode
const demoFlowerSignups = [];

// In-memory church-provided services for demo mode
const demoServiceProvisions = [];

/**
 * Tell the secretary and treasurer that a pledge was made or withdrawn.
 *
 * Fire-and-forget by design: the sign-up itself has already committed, so a
 * mail failure must not surface as a failed pledge. Everything passed here is a
 * key the Edge Function looks up — the name comes from the members table (after
 * it checks the member is linked to the caller) and the service name from Google
 * Calendar — so no text from the app reaches the email.
 */
const notifySignup = async (kind, action, memberId, eventDate, eventId) => {
  try {
    const { error } = await supabase.functions.invoke('notify-signup', {
      body: { kind, action, memberId, eventDate, eventId },
    });
    if (error) {
      console.warn('[signup notify] not sent:', error.message);
      logClientError('signup.notify', error, { kind, action });
    }
  } catch (err) {
    console.warn('[signup notify] not sent:', err);
    logClientError('signup.notify', err, { kind, action });
  }
};

/**
 * Both unique indexes on the sign-up tables surface as 23505, and neither raw
 * message is any use to a member. The full-pledge one is genuinely reachable:
 * two people can open the same service and both choose to cover it.
 */
const signupErrorMessage = (error) => {
  if (error.code !== '23505') return error.message;
  return error.message.includes('full_pledge')
    ? 'Someone else has already pledged to donate for this service.'
    : 'You have already pledged for this service.';
};

// ── Row mappers ───────────────────────────────────────────────────────────────

const mapFamily = (row) => ({
  id: row.id,
  familyName: row.family_name,
  membershipId: row.membership_id,
  address: {
    street: row.address,
    street2: row.address2,
    city: row.city,
    state: row.state,
    zipCode: row.zip,
  },
  photoUrl: row.photo_url,
  isActive: row.is_active,
});

const mapMember = (row) => ({
  id: row.id,
  familyId: row.family_id,
  firstName: row.first_name,
  lastName: row.last_name,
  alias: row.alias ?? null,
  email: row.email,
  phoneNumber: row.phone_number,
  role: row.role,
  isHeadOfHousehold: row.is_head_of_household ?? false,
  isActive: row.is_active,
  photoUrl: row.photo_url,
});


const mapAppSettings = (row) => ({
  googleCalendarId: row.google_calendar_id,
  googleApiKey: row.google_api_key,
  youtubeApiKey: row.youtube_api_key,
  churchName: row.church_name,
  churchAddress: row.church_address,
  contactEmail: row.contact_email,
  enableMealSignup: row.enable_meal_signup ?? false,
  enableFlowerSignup: row.enable_flower_signup ?? false,
  enableDocuments: row.enable_documents ?? false,
  assemblyDocsFolderId: row.assembly_docs_folder_id ?? null,
  enablePhotos: row.enable_photos ?? false,
  photosSiteUrl: row.photos_site_url ?? null,
  photosParentPageId: row.photos_parent_page_id ?? null,
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
    if (isDemoSession()) {
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
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const families = demoFamilies
        .filter(f => f.isActive)
        .sort((a, b) => a.familyName.localeCompare(b.familyName))
        .map(f => {
          const hohMembers = demoMembers.filter(
            m => m.familyId === f.id && m.isHeadOfHousehold && m.isActive
          );
          const hohNames = hohMembers.map(m => m.firstName).join(' & ') || null;
          const allMembers = demoMembers.filter(m => m.familyId === f.id && m.isActive);
          const memberFirstNames = allMembers.map(m => m.firstName);
          const memberLastNames = allMembers.map(m => m.lastName).filter(Boolean);
          const memberAliases = allMembers.map(m => m.alias).filter(Boolean);
          const memberPhoneNumbers = allMembers.map(m => m.phoneNumber).filter(Boolean);
          return {
            ...f,
            photoUrl: demoPhotoOverrides[f.id] || f.photoUrl,
            hohNames,
            memberFirstNames,
            memberLastNames,
            memberAliases,
            memberPhoneNumbers,
          };
        });
      return { data: families, error: null };
    }

    const { data, error } = await supabase
      .from('families')
      .select('*, members(id, first_name, last_name, alias, phone_number, is_head_of_household, created_at)')
      .eq('is_active', true)
      .order('family_name', { ascending: true });

    if (error) return { data: null, error: error.message };
    return {
      data: data.map(row => {
        const family = mapFamily(row);
        const hohMembers = (row.members || [])
          .filter(m => m.is_head_of_household)
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        family.hohNames = hohMembers.map(m => m.first_name).join(' & ') || null;
        family.memberFirstNames = (row.members || []).map(m => m.first_name);
        family.memberLastNames = (row.members || []).map(m => m.last_name).filter(Boolean);
        family.memberAliases = (row.members || []).map(m => m.alias).filter(Boolean);
        family.memberPhoneNumbers = (row.members || []).map(m => m.phone_number).filter(Boolean);
        return family;
      }),
      error: null,
    };
  }

  async getFamilyById(familyId) {
    if (isDemoSession()) {
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
    if (isDemoSession()) {
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
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const member = demoMembers.find(m => m.userId === userId);
      if (!member) return { data: null, error: 'Member not found' };
      return { data: member, error: null };
    }

    const { data, error } = await supabase
      .from('member_users')
      .select('members(*)')
      .eq('user_id', userId)
      .limit(1);

    if (error) return { data: null, error: error.message };
    const row = data?.[0]?.members;
    return { data: row ? mapMember(row) : null, error: null };
  }

  async getMemberByEmail(email) {
    // Multiple members may share an email — return the first match
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (error) return { data: null, error: error.message };
    return { data: data?.[0] ? mapMember(data[0]) : null, error: null };
  }

  async getMembersByEmail(email) {
    // Returns ALL members sharing this email (for bulk-linking on first login)
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('email', email);

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []).map(mapMember), error: null };
  }

  async linkMemberToUser(memberId, userId) {
    const { error } = await supabase
      .from('member_users')
      .upsert({ user_id: userId, member_id: memberId }, { onConflict: 'user_id,member_id' });

    return { error: error?.message ?? null };
  }

  // Records which build this member is running on this device, for the Users &
  // Roles column. Fire-and-forget: called on every launch, and a failure here
  // must never keep anyone out of the app.
  async recordAppLaunch() {
    if (isDemoSession() || !supabase) return;

    try {
      const deviceId = await getDeviceId();
      if (!deviceId) return;

      const info = buildInfo();
      const { error } = await supabase.rpc('record_app_launch', {
        p_device_id: deviceId,
        p_app_version: info.app_version,
        p_update_id: info.update_id,
        p_update_created_at: info.update_created_at,
        p_platform: info.platform,
        p_os_version: info.os_version,
      });

      if (error) console.warn('[app launch] not recorded:', error.message);
    } catch (err) {
      console.warn('[app launch] not recorded:', err);
    }
  }

  async getUserRole(userId) {
    if (isDemoSession()) {
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
    if (isDemoSession()) {
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

  async getContributionCategoryAmounts() {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { data: demoContributionCategoryAmounts, error: null };
    }

    const { data, error } = await supabase
      .from('contribution_category_amounts')
      .select('category, requested_amount');

    if (error) return { data: null, error: error.message };
    return {
      data: data.map(row => ({ category: row.category, requestedAmount: Number(row.requested_amount) })),
      error: null,
    };
  }

  async getContributionSettings() {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { asofDate: new Date().toISOString().slice(0, 10) };
    }

    const { data, error } = await supabase
      .from('contribution_settings')
      .select('asof_date')
      .eq('id', 1)
      .single();

    if (error || !data) return null;
    return { asofDate: data.asof_date };
  }

  async getMealSignupCount(eventId) {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { data: demoMealSignups.filter(s => s.eventId === eventId).length, error: null };
    }
    const { data, error } = await supabase.rpc('meal_signup_count_for_event', { p_event_id: eventId });
    if (error) return { data: 0, error: error.message };
    return { data: Number(data), error: null };
  }

  async getMealSignups(eventId) {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const signups = demoMealSignups
        .filter(s => s.eventId === eventId)
        .map(s => {
          const m = demoMembers.find(dm => dm.id === s.memberId);
          return {
            id: s.id,
            memberId: s.memberId,
            pledgeType: s.pledgeType,
            createdAt: s.createdAt,
            member: m ? { firstName: m.firstName, lastName: m.lastName, familyId: m.familyId } : null,
          };
        });
      return { data: signups, error: null };
    }
    const { data, error } = await supabase
      .from('meal_signups')
      .select('id, member_id, pledge_type, created_at, member:members(first_name, last_name, family_id, family:families(membership_id))')
      .eq('event_id', eventId);
    if (error) return { data: null, error: error.message };
    return {
      data: (data ?? []).map(row => ({
        id: row.id,
        memberId: row.member_id,
        pledgeType: row.pledge_type,
        createdAt: row.created_at,
        member: row.member
          ? {
              firstName: row.member.first_name,
              lastName: row.member.last_name,
              familyId: row.member.family_id,
              membershipId: row.member.family?.membership_id ?? null,
            }
          : null,
      })),
      error: null,
    };
  }

  async createMealSignup(memberId, eventDate, eventId, pledgeType) {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const existing = demoMealSignups.find(s => s.memberId === memberId && s.eventId === eventId);
      if (existing) return { data: existing, error: null };
      const signup = { id: `demo-signup-${Date.now()}`, memberId, eventDate, eventId, pledgeType, createdAt: new Date().toISOString() };
      demoMealSignups.push(signup);
      return { data: signup, error: null };
    }
    const { data, error } = await supabase
      .from('meal_signups')
      .insert({ member_id: memberId, event_date: eventDate, event_id: eventId, pledge_type: pledgeType })
      .select('id')
      .single();
    if (error) return { data: null, error: signupErrorMessage(error) };
    notifySignup('meal', 'created', memberId, eventDate, eventId);
    return { data: { id: data.id }, error: null };
  }

  async deleteMealSignup(signupId, memberId, eventDate, eventId) {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const idx = demoMealSignups.findIndex(s => s.id === signupId);
      if (idx !== -1) demoMealSignups.splice(idx, 1);
      return { error: null };
    }
    const { error } = await supabase.from('meal_signups').delete().eq('id', signupId);
    if (error) return { error: error.message };
    notifySignup('meal', 'cancelled', memberId, eventDate, eventId);
    return { error: null };
  }

  async getMealSignupEventIds(fromDate, toDate) {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const ids = [...new Set(
        demoMealSignups
          .filter(s => s.eventDate >= fromDate && s.eventDate <= toDate && s.eventId)
          .map(s => s.eventId)
      )];
      return { data: ids, error: null };
    }
    const { data, error } = await supabase.rpc('meal_signup_event_ids_in_range', { p_from: fromDate, p_to: toDate });
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []).map(row => row.event_id), error: null };
  }

  // Which services in a range this member pledged for, and how. Their own rows
  // are visible under RLS, so unlike the counts this needs no security-definer
  // function — it reads the table directly.
  async getMyMealPledgesInRange(memberId, fromDate, toDate) {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const pledges = demoMealSignups
        .filter(s => s.memberId === memberId && s.eventDate >= fromDate && s.eventDate <= toDate && s.eventId)
        .map(s => ({ eventId: s.eventId, pledgeType: s.pledgeType ?? null }));
      return { data: pledges, error: null };
    }
    const { data, error } = await supabase
      .from('meal_signups')
      .select('event_id, pledge_type')
      .eq('member_id', memberId)
      .gte('event_date', fromDate)
      .lte('event_date', toDate);
    if (error) return { data: null, error: error.message };
    return {
      data: (data ?? [])
        .filter(row => row.event_id)
        .map(row => ({ eventId: row.event_id, pledgeType: row.pledge_type })),
      error: null,
    };
  }

  // Whether one member has already taken the whole service on. RLS hides other
  // members' rows, so this cannot be read off the roster.
  async getMealFullPledge(eventId) {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { data: demoMealSignups.some(s => s.eventId === eventId && s.pledgeType === 'full'), error: null };
    }
    const { data, error } = await supabase.rpc('meal_full_pledge_for_event', { p_event_id: eventId });
    if (error) return { data: false, error: error.message };
    return { data: Boolean(data), error: null };
  }

  async getFlowerSignupCount(eventId) {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { data: demoFlowerSignups.filter(s => s.eventId === eventId).length, error: null };
    }
    const { data, error } = await supabase.rpc('flower_signup_count_for_event', { p_event_id: eventId });
    if (error) return { data: 0, error: error.message };
    return { data: Number(data), error: null };
  }

  async getFlowerSignups(eventId) {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const signups = demoFlowerSignups
        .filter(s => s.eventId === eventId)
        .map(s => {
          const m = demoMembers.find(dm => dm.id === s.memberId);
          return {
            id: s.id,
            memberId: s.memberId,
            pledgeType: s.pledgeType,
            createdAt: s.createdAt,
            member: m ? { firstName: m.firstName, lastName: m.lastName, familyId: m.familyId } : null,
          };
        });
      return { data: signups, error: null };
    }
    const { data, error } = await supabase
      .from('flower_signups')
      .select('id, member_id, pledge_type, created_at, member:members(first_name, last_name, family_id, family:families(membership_id))')
      .eq('event_id', eventId);
    if (error) return { data: null, error: error.message };
    return {
      data: (data ?? []).map(row => ({
        id: row.id,
        memberId: row.member_id,
        pledgeType: row.pledge_type,
        createdAt: row.created_at,
        member: row.member
          ? {
              firstName: row.member.first_name,
              lastName: row.member.last_name,
              familyId: row.member.family_id,
              membershipId: row.member.family?.membership_id ?? null,
            }
          : null,
      })),
      error: null,
    };
  }

  async createFlowerSignup(memberId, eventDate, eventId, pledgeType) {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const existing = demoFlowerSignups.find(s => s.memberId === memberId && s.eventId === eventId);
      if (existing) return { data: existing, error: null };
      const signup = { id: `demo-signup-${Date.now()}`, memberId, eventDate, eventId, pledgeType, createdAt: new Date().toISOString() };
      demoFlowerSignups.push(signup);
      return { data: signup, error: null };
    }
    const { data, error } = await supabase
      .from('flower_signups')
      .insert({ member_id: memberId, event_date: eventDate, event_id: eventId, pledge_type: pledgeType })
      .select('id')
      .single();
    if (error) return { data: null, error: signupErrorMessage(error) };
    notifySignup('flower', 'created', memberId, eventDate, eventId);
    return { data: { id: data.id }, error: null };
  }

  async deleteFlowerSignup(signupId, memberId, eventDate, eventId) {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const idx = demoFlowerSignups.findIndex(s => s.id === signupId);
      if (idx !== -1) demoFlowerSignups.splice(idx, 1);
      return { error: null };
    }
    const { error } = await supabase.from('flower_signups').delete().eq('id', signupId);
    if (error) return { error: error.message };
    notifySignup('flower', 'cancelled', memberId, eventDate, eventId);
    return { error: null };
  }

  async getFlowerSignupEventIds(fromDate, toDate) {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const ids = [...new Set(
        demoFlowerSignups
          .filter(s => s.eventDate >= fromDate && s.eventDate <= toDate && s.eventId)
          .map(s => s.eventId)
      )];
      return { data: ids, error: null };
    }
    const { data, error } = await supabase.rpc('flower_signup_event_ids_in_range', { p_from: fromDate, p_to: toDate });
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []).map(row => row.event_id), error: null };
  }

  // Which services in a range this member pledged for, and how. Their own rows
  // are visible under RLS, so unlike the counts this needs no security-definer
  // function — it reads the table directly.
  async getMyFlowerPledgesInRange(memberId, fromDate, toDate) {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const pledges = demoFlowerSignups
        .filter(s => s.memberId === memberId && s.eventDate >= fromDate && s.eventDate <= toDate && s.eventId)
        .map(s => ({ eventId: s.eventId, pledgeType: s.pledgeType ?? null }));
      return { data: pledges, error: null };
    }
    const { data, error } = await supabase
      .from('flower_signups')
      .select('event_id, pledge_type')
      .eq('member_id', memberId)
      .gte('event_date', fromDate)
      .lte('event_date', toDate);
    if (error) return { data: null, error: error.message };
    return {
      data: (data ?? [])
        .filter(row => row.event_id)
        .map(row => ({ eventId: row.event_id, pledgeType: row.pledge_type })),
      error: null,
    };
  }

  // Whether one member has already taken the whole service on. RLS hides other
  // members' rows, so this cannot be read off the roster.
  async getFlowerFullPledge(eventId) {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { data: demoFlowerSignups.some(s => s.eventId === eventId && s.pledgeType === 'full'), error: null };
    }
    const { data, error } = await supabase.rpc('flower_full_pledge_for_event', { p_event_id: eventId });
    if (error) return { data: false, error: error.message };
    return { data: Boolean(data), error: null };
  }

  // ── Church-provided services ────────────────────────────────────────────────
  // Kept apart from the sign-up tables so an admin with no member record — the
  // secretary and treasurer both sign in on office accounts — can still mark a
  // service. `kind` is 'meal' or 'flower'.

  async getServiceProvision(kind, eventId) {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { data: demoServiceProvisions.some(p => p.kind === kind && p.eventId === eventId), error: null };
    }
    const { data, error } = await supabase
      .from('service_provisions')
      .select('event_id')
      .eq('kind', kind)
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) return { data: false, error: error.message };
    return { data: !!data, error: null };
  }

  async setServiceProvision(kind, eventId, eventDate) {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      if (!demoServiceProvisions.some(p => p.kind === kind && p.eventId === eventId)) {
        demoServiceProvisions.push({ kind, eventId, eventDate });
      }
      return { error: null };
    }
    // Upsert rather than insert: marking a service twice is a no-op, not an error
    const { error } = await supabase
      .from('service_provisions')
      .upsert({ kind, event_id: eventId, event_date: eventDate }, { onConflict: 'event_id,kind' });
    return { error: error?.message ?? null };
  }

  // Every church-provided service in a date range, so the Sign-Ups list can show
  // it on collapsed rows without a query per service.
  async getServiceProvisionsInRange(fromDate, toDate) {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return {
        data: demoServiceProvisions
          .filter(p => p.eventDate >= fromDate && p.eventDate <= toDate)
          .map(p => ({ kind: p.kind, eventId: p.eventId })),
        error: null,
      };
    }
    const { data, error } = await supabase
      .from('service_provisions')
      .select('kind, event_id')
      .gte('event_date', fromDate)
      .lte('event_date', toDate);
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []).map(row => ({ kind: row.kind, eventId: row.event_id })), error: null };
  }

  async clearServiceProvision(kind, eventId) {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const idx = demoServiceProvisions.findIndex(p => p.kind === kind && p.eventId === eventId);
      if (idx !== -1) demoServiceProvisions.splice(idx, 1);
      return { error: null };
    }
    const { error } = await supabase
      .from('service_provisions')
      .delete()
      .eq('kind', kind)
      .eq('event_id', eventId);
    return { error: error?.message ?? null };
  }

  async getChurchContacts() {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { data: demoChurchContacts, error: null };
    }

    const { data, error } = await supabase
      .from('church_contacts')
      .select('*')
      .order('display_order');

    if (error) return { data: null, error: error.message };
    return {
      data: (data ?? []).map(row => ({
        role: row.role,
        name: row.name,
        phone: row.phone,
        email: row.email,
      })),
      error: null,
    };
  }

  async getAppSettings() {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { data: demoAppSettings, error: null };
    }

    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 'config')
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapAppSettings(data), error: null };
  }
}

export default new DatabaseService();
