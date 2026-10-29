import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

// GET /api/admin/audit
export async function GET(request: NextRequest) {
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const action = request.nextUrl.searchParams.get('action');
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
  const page = parseInt(request.nextUrl.searchParams.get('page') || '1', 10);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = await createAdminClient();

  let query = supabase
    .from('audit_logs')
    .select(`
      *,
      performer:profiles(full_name, email),
      target_team:teams(name),
      target_student:students(full_name, student_id),
      target_group:academic_groups(name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (action) {
    query = query.eq('action', action);
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    logs: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
