import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

// GET /api/admin/settings
export async function GET() {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .order('key');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Convert array of { key, value, description } to a key-value dictionary
  const settings: Record<string, any> = {};
  for (const item of (data || [])) {
    settings[item.key] = item.value;
  }

  return NextResponse.json({ settings, raw: data || [] });
}

// POST /api/admin/settings - Update settings
export async function POST(request: NextRequest) {
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json();
  const { settings } = body;

  if (!settings || typeof settings !== 'object') {
    return NextResponse.json({ error: 'invalid_settings_format' }, { status: 400 });
  }

  const supabase = await createAdminClient();

  // Upsert settings
  for (const [key, value] of Object.entries(settings)) {
    await supabase
      .from('system_settings')
      .upsert({
        key,
        value: typeof value === 'string' ? JSON.stringify(value) : value,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      });
  }

  await supabase.from('audit_logs').insert({
    action: 'settings_change',
    performed_by: user.id,
    new_values: settings,
  });

  return NextResponse.json({ success: true });
}
