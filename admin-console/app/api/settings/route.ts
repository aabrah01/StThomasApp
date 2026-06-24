import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { NextResponse } from 'next/server';

// Accepts a full Drive folder URL or a bare folder id and returns the id.
// Empty input clears the setting (returns null).
function parseFolderId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch) return idParamMatch[1];
  return trimmed;
}

export async function GET() {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const supabase = createAdminSupabase();
  const { data } = await supabase
    .from('app_settings')
    .select('enable_meal_signup, enable_flower_signup, enable_documents, assembly_docs_folder_id')
    .eq('id', 'config')
    .single();

  return NextResponse.json({
    enableMealSignup: data?.enable_meal_signup ?? false,
    enableFlowerSignup: data?.enable_flower_signup ?? false,
    enableDocuments: data?.enable_documents ?? false,
    assemblyDocsFolderId: data?.assembly_docs_folder_id ?? '',
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const body = await request.json();
  const { enableMealSignup, enableFlowerSignup, enableDocuments, assemblyDocsFolderId } = body;

  const updates: Record<string, boolean | string | null> = {};
  if (enableMealSignup !== undefined) {
    if (typeof enableMealSignup !== 'boolean') {
      return NextResponse.json({ error: 'enableMealSignup must be a boolean' }, { status: 400 });
    }
    updates.enable_meal_signup = enableMealSignup;
  }
  if (enableFlowerSignup !== undefined) {
    if (typeof enableFlowerSignup !== 'boolean') {
      return NextResponse.json({ error: 'enableFlowerSignup must be a boolean' }, { status: 400 });
    }
    updates.enable_flower_signup = enableFlowerSignup;
  }
  if (enableDocuments !== undefined) {
    if (typeof enableDocuments !== 'boolean') {
      return NextResponse.json({ error: 'enableDocuments must be a boolean' }, { status: 400 });
    }
    updates.enable_documents = enableDocuments;
  }
  if (assemblyDocsFolderId !== undefined) {
    if (typeof assemblyDocsFolderId !== 'string') {
      return NextResponse.json({ error: 'assemblyDocsFolderId must be a string' }, { status: 400 });
    }
    updates.assembly_docs_folder_id = parseFolderId(assemblyDocsFolderId);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No settings provided' }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: 'config', ...updates });

  if (error) return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'update',
    table_name: 'app_settings',
    record_id: 'config',
    details: updates,
  });

  return NextResponse.json({
    enableMealSignup,
    enableFlowerSignup,
    enableDocuments,
    assemblyDocsFolderId: updates.assembly_docs_folder_id ?? assemblyDocsFolderId,
  });
}
