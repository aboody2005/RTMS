import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

// PATCH /api/admin/teams/[id] - Edit team (name, capacity, rabbit_number, description)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json();
  const supabase = await createAdminClient();

  // If updating capacity, check if new capacity is less than confirmed members
  if (body.max_capacity !== undefined) {
    const { count } = await supabase
      .from('team_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', id)
      .eq('status', 'confirmed');

    if (count && Number(body.max_capacity) < count && !body.force) {
      return NextResponse.json({
        error: 'capacity_less_than_members',
        current_members: count,
        requested_capacity: body.max_capacity,
        message: `لا يمكن تقليل سعة الفريق إلى ${body.max_capacity} لأن الفريق يضم حالياً ${count} طلاب مؤكدين. يرجى نقل أو إزالة الطلاب الزائدين أولاً.`
      }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from('teams')
    .update(body)
    .eq('id', id)
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
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from('audit_logs').insert({
    action: 'team_update',
    performed_by: user.id,
    target_team_id: id,
    new_values: data,
  });

  const sanitizedTeam = data ? {
    ...data,
    memberships: (data.memberships || []).filter((m: any) =>
      ['confirmed', 'invitation_pending'].includes(m.status)
    ),
  } : data;

  return NextResponse.json({ team: sanitizedTeam });
}

// DELETE /api/admin/teams/[id] - Safe delete/archive
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = await createAdminClient();

  // Check for confirmed members
  const { count } = await supabase
    .from('team_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', id)
    .eq('status', 'confirmed');

  if (count && count > 0) {
    return NextResponse.json({
      error: 'team_has_confirmed_members',
      count,
      message: `لا يمكن حذف الفريق لأنه يحتوي على ${count} طلاب مؤكدين. يرجى إعادة توزيعهم أو إزالتهم أولاً.`
    }, { status: 409 });
  }

  const { error } = await supabase
    .from('teams')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from('audit_logs').insert({
    action: 'team_delete',
    performed_by: user.id,
    target_team_id: id,
  });

  return NextResponse.json({ success: true });
}
