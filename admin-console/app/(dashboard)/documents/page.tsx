import { createAdminSupabase } from '@/lib/supabase';
import { DEMO_DOCUMENTS } from '@/lib/demoData';
import DocumentsClient from './DocumentsClient';
import type { Document } from '@/lib/types';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage() {
  let docs: Document[];

  if (DEMO_MODE) {
    docs = DEMO_DOCUMENTS;
  } else {
    const supabase = createAdminSupabase();
    const { data: documents } = await supabase
      .from('documents').select('*')
      .order('year', { ascending: false }).order('created_at', { ascending: false });
    docs = (documents ?? []).map(d => ({
      id: d.id, title: d.title, type: d.type, url: d.url, year: d.year, createdAt: d.created_at,
    }));
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-500 text-sm">Tax letters, annual reports, and receipts for parish members</p>
        </div>
      </div>
      <DocumentsClient documents={docs} />
    </div>
  );
}
