import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/admin/groups
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const adminSupabase = await createAdminClient();

  const { data: groups, error } = await adminSupabase
    .from('academic_groups')
    .select(`
      *,
      students:students(count),
      teams:teams(
        id, name, max_capacity, is_active,
        memberships:team_memberships(status)
      )
    `)
    .eq('is_active', true)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = (groups || []).map(group => {
    const allStudents = (group.students as unknown as { count: number }[])?.[0]?.count || 0;
    const confirmed = (group.teams as { memberships: { status: string }[] }[])
      ?.flatMap(t => t.memberships || [])
      .filter(m => m.status === 'confirmed').length || 0;
    const pending = (group.teams as { memberships: { status: string }[] }[])
      ?.flatMap(t => t.memberships || [])
      .filter(m => m.status === 'invitation_pending').length || 0;

    return {
      ...group,
      total_students: allStudents,
      confirmed_students: confirmed,
      pending_students: pending,
      unassigned_students: allStudents - confirmed - pending,
    };
  });

  return NextResponse.json({ groups: enriched });
}

// POST /api/admin/groups
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json();
  const adminSupabase = await createAdminClient();

  const { data, error } = await adminSupabase
    .from('academic_groups')
    .insert({ ...body, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await adminSupabase.from('audit_logs').insert({
    action: 'group_create',
    performed_by: user.id,
    target_group_id: data.id,
    new_values: data,
  });

  return NextResponse.json({ group: data }, { status: 201 });
}
