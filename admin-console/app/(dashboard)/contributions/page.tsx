import { createAdminSupabase } from '@/lib/supabase';
import { DEMO_CONTRIBUTIONS, DEMO_FAMILIES } from '@/lib/demoData';
import ContributionsClient, { type LastImport } from './ContributionsClient';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const dynamic = 'force-dynamic';

export default async function ContributionsPage() {
  let contribs: { id: string; familyId: string; membershipId: string; familyName: string; date: string; amount: number; category: string; fiscalYear: number }[];
  let familyOptions: { id: string; name: string; membershipId: string }[];
  let categories: string[];
  let categoryAmounts: { category: string; requestedAmount: number }[];
  let statementSettings: { introParagraph: string; closingParagraph: string };
  let driveSettings: { folderId: string; reportRecipients: string };
  let lastImport: LastImport | null;

  if (DEMO_MODE) {
    const familyById = new Map(DEMO_FAMILIES.map(f => [f.id, f]));
    contribs = DEMO_CONTRIBUTIONS.map(c => ({ ...c, membershipId: familyById.get(c.familyId)?.membershipId ?? '' }));
    familyOptions = DEMO_FAMILIES.map(f => ({ id: f.id, name: f.familyName, membershipId: f.membershipId ?? '' }));
    categories = Array.from(new Set(DEMO_CONTRIBUTIONS.map(c => c.category))).sort();
    categoryAmounts = [];
    statementSettings = { introParagraph: '', closingParagraph: '' };
    driveSettings = { folderId: '', reportRecipients: '' };
    lastImport = null;
  } else {
    const supabase = createAdminSupabase();
    const [{ data: contributions }, { data: families }, { data: allCategories }, { data: amounts }, { data: settings }, { data: importSettings }, { data: lastImportRow }] = await Promise.all([
      supabase.from('contributions').select('*, families(family_name, membership_id)').order('date', { ascending: false }).limit(200),
      supabase.from('families').select('id, family_name, membership_id').order('family_name'),
      supabase.from('contributions').select('category'),
      supabase.from('contribution_category_amounts').select('category, requested_amount').order('category'),
      supabase.from('contribution_settings').select('intro_paragraph, closing_paragraph').eq('id', 1).single(),
      supabase.from('import_settings').select('folder_id, report_recipients').eq('id', 'contributions').maybeSingle(),
      supabase
        .from('contribution_imports')
        .select('trigger, status, actor, file_name, row_count, unmatched_count, member_entries, member_entries_matched, message, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    contribs = (contributions ?? []).map(c => ({
      id: c.id, familyId: c.family_id,
      membershipId: (c.families as { family_name: string; membership_id: string } | null)?.membership_id ?? '—',
      familyName: (c.families as { family_name: string; membership_id: string } | null)?.family_name ?? '—',
      date: c.date, amount: c.amount, category: c.category, fiscalYear: c.fiscal_year,
    }));
    familyOptions = (families ?? []).map(f => ({ id: f.id, name: f.family_name, membershipId: f.membership_id ?? '' }));
    categories = Array.from(new Set((allCategories ?? []).map(c => c.category as string).filter(Boolean))).sort();
    categoryAmounts = (amounts ?? []).map(a => ({ category: a.category, requestedAmount: Number(a.requested_amount) }));
    statementSettings = {
      introParagraph: settings?.intro_paragraph ?? '',
      closingParagraph: settings?.closing_paragraph ?? '',
    };
    driveSettings = {
      folderId: importSettings?.folder_id ?? '',
      reportRecipients: importSettings?.report_recipients ?? '',
    };
    lastImport = (lastImportRow as LastImport | null) ?? null;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contributions</h1>
          <p className="text-gray-500 text-sm">Import from Excel (.xlsx) or add manually</p>
        </div>
      </div>
      <ContributionsClient
        contributions={contribs}
        families={familyOptions}
        categories={categories}
        initialCategoryAmounts={categoryAmounts}
        initialStatementSettings={statementSettings}
        initialDriveSettings={driveSettings}
        initialLastImport={lastImport}
      />
    </div>
  );
}
