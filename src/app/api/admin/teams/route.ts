import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { generateSecureToken, hashToken } from '@/lib/utils';

// GET /api/admin/teams
export async function GET(request: NextRequest) {
  const groupId = request.nextUrl.searchParams.get('group_id');
  const supabase = await createAdminClient();

  let query = supabase
    .from('teams')
    .select(`
      *,
      academic_group:academic_groups(id, name),
      team_leader:team_leaders(
        id, is_active, link_revoked_at, access_token_prefix,
        student:students(id, full_name)
      ),
      memberships:team_memberships(id, status, is_leader,
        student:students(id, full_name)
      )
    `)
    .eq('is_active', true)
    .order('academic_group_id')
    .order('name');

  if (groupId) query = query.eq('academic_group_id', groupId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Only return current active members (confirmed or invitation_pending).
  // Historical removed/revoked records are safely preserved in the database for audit logs.
  const teams = (data || []).map((team: any) => ({
    ...team,
    memberships: (team.memberships || []).filter((m: any) =>
      ['confirmed', 'invitation_pending'].includes(m.status)
    ),
  }));

  return NextResponse.json({ teams });
}

// POST /api/admin/teams
export async function POST(request: NextRequest) {
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json();
  const supabase = await createAdminClient();

  // Handle bulk creation
  if (body.bulk && body.count) {
    let fallbackCapacity = 6;
    if (!body.max_capacity) {
      const { data: capSetting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'default_team_capacity')
        .single();
      if (capSetting?.value) fallbackCapacity = Number(capSetting.value);
    }

    const { academic_group_id, count, name_prefix = 'الفريق' } = body;
    const max_capacity = body.max_capacity ? Number(body.max_capacity) : fallbackCapacity;
    
    // Fetch group name for clear hierarchical naming: الفريق X — المجموعة Y
    const { data: group } = await supabase
      .from('academic_groups')
      .select('name')
      .eq('id', academic_group_id)
      .single();
    const groupSuffix = group?.name ? ` — المجموعة ${group.name}` : '';

    const teams = Array.from({ length: count }, (_, i) => ({
      name: `${name_prefix} ${i + 1}`,
      academic_group_id,
      max_capacity,
      rabbit_number: i + 1,
      created_by: user.id,
    }));

    const { data, error } = await supabase.from('teams').insert(teams).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    for (const team of data) {
      await supabase.from('audit_logs').insert({
        action: 'team_create',
        performed_by: user.id,
        target_team_id: team.id,
        target_group_id: academic_group_id,
        new_values: team,
      });
    }

    return NextResponse.json({ teams: data }, { status: 201 });
  }

  // Single team
  let teamCapacity = body.max_capacity;
  if (!teamCapacity) {
    const { data: capSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'default_team_capacity')
      .single();
    teamCapacity = capSetting?.value ? Number(capSetting.value) : 6;
  }

  const { data, error } = await supabase
    .from('teams')
    .insert({ ...body, max_capacity: Number(teamCapacity), created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from('audit_logs').insert({
    action: 'team_create',
    performed_by: user.id,
    target_team_id: data.id,
    target_group_id: data.academic_group_id,
    new_values: data,
  });

  return NextResponse.json({ team: data }, { status: 201 });
}
