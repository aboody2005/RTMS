import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

// GET /api/admin/students
export async function GET(request: NextRequest) {
  const groupId = request.nextUrl.searchParams.get('group_id');
  const search = request.nextUrl.searchParams.get('search');
  const status = request.nextUrl.searchParams.get('status'); // available, pending, confirmed
  const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
  const pageSize = parseInt(request.nextUrl.searchParams.get('pageSize') || '50');

  const supabase = await createAdminClient();

  let query = supabase
    .from('students')
    .select(`
      *,
      academic_group:academic_groups(id, name),
      memberships:team_memberships(
        id, status, is_leader, team_id,
        team:teams(id, name)
      )
    `, { count: 'exact' })
    .eq('is_active', true)
    .order('academic_group_id')
    .order('full_name');

  if (groupId) query = query.eq('academic_group_id', groupId);
  if (search) query = query.ilike('full_name', `%${search}%`);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with effective status
  const enriched = (data || []).map(student => {
    const activeMembership = (student.memberships as { status: string; team?: { name: string }; team_id: string }[])
      ?.find(m => ['confirmed', 'invitation_pending'].includes(m.status));

    return {
      ...student,
      effective_status: activeMembership?.status || 'available',
      current_team: activeMembership?.team || null,
      current_team_id: activeMembership?.team_id || null,
    };
  });

  // Filter by status if requested
  const filtered = status
    ? enriched.filter(s => s.effective_status === status)
    : enriched;

  return NextResponse.json({
    students: filtered,
    count: count || 0,
    page,
    pageSize,
  });
}

// POST /api/admin/students
export async function POST(request: NextRequest) {
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json();
  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from('students')
    .insert({ ...body, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from('audit_logs').insert({
    action: 'student_create',
    performed_by: user.id,
    target_student_id: data.id,
    target_group_id: data.academic_group_id,
    new_values: { name: data.full_name, group: data.academic_group_id },
  });

  return NextResponse.json({ student: data }, { status: 201 });
}
