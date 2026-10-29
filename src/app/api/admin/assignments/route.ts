import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { generateSecureToken, hashToken, buildInvitationUrl } from '@/lib/utils';

// GET /api/admin/assignments?group_id=xxx
export async function GET(request: NextRequest) {
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const groupId = request.nextUrl.searchParams.get('group_id');
  const supabase = await createAdminClient();

  // Fetch groups
  const { data: groups } = await supabase
    .from('academic_groups')
    .select('*')
    .eq('is_active', true)
    .order('name');

  const activeGroupId = groupId || (groups && groups.length > 0 ? groups[0].id : null);

  if (!activeGroupId) {
    return NextResponse.json({ groups: [], teams: [], unassigned: [] });
  }

  // Fetch teams with memberships and leader
  const { data: teams } = await supabase
    .from('teams')
    .select(`
      *,
      academic_group:academic_groups(id, name),
      team_leader:team_leaders(
        id, student_id, is_active, link_revoked_at,
        student:students(id, full_name, student_id)
      ),
      memberships:team_memberships(
        id, status, is_leader, confirmed_at, created_at,
        student:students(id, full_name, student_id, email, phone)
      )
    `)
    .eq('academic_group_id', activeGroupId)
    .eq('is_active', true)
    .order('name');

  // Fetch all students in this group
  const { data: groupStudents } = await supabase
    .from('students')
    .select('id, full_name, student_id, email, phone, academic_group_id')
    .eq('academic_group_id', activeGroupId)
    .eq('is_active', true)
    .order('full_name');

  // Find confirmed or pending student IDs
  const assignedIds = new Set<string>();
  (teams || []).forEach((t: any) => {
    (t.memberships || []).forEach((m: any) => {
      if (['confirmed', 'invitation_pending'].includes(m.status) && m.student?.id) {
        assignedIds.add(m.student.id);
      }
    });
  });

  const sanitizedTeams = (teams || []).map((t: any) => ({
    ...t,
    memberships: (t.memberships || []).filter((m: any) =>
      ['confirmed', 'invitation_pending'].includes(m.status)
    ),
  }));

  const unassigned = (groupStudents || []).filter((s: any) => !assignedIds.has(s.id));

  return NextResponse.json({
    groups: groups || [],
    teams: sanitizedTeams,
    unassigned,
  });
}

// POST /api/admin/assignments
export async function POST(request: NextRequest) {
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json();
  const { action, student_id, team_id, from_team_id, to_team_id, membership_id, capacity } = body;
  const supabase = await createAdminClient();

  // 1. ADD student to team (admin direct assignment or pending)
  if (action === 'add') {
    if (!student_id || !team_id) {
      return NextResponse.json({ error: 'student_and_team_required' }, { status: 400 });
    }

    // Verify student and team belong to same group
    const { data: student } = await supabase.from('students').select('*').eq('id', student_id).single();
    const { data: team } = await supabase.from('teams').select('*').eq('id', team_id).single();

    if (!student || !team) {
      return NextResponse.json({ error: 'student_or_team_not_found' }, { status: 404 });
    }

    if (student.academic_group_id !== team.academic_group_id) {
      return NextResponse.json({ error: 'academic_group_mismatch' }, { status: 400 });
    }

    // Check confirmed capacity
    const { count: confirmedCount } = await supabase
      .from('team_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team_id)
      .eq('status', 'confirmed');

    if ((confirmedCount || 0) >= team.max_capacity) {
      return NextResponse.json({ error: 'team_at_capacity' }, { status: 400 });
    }

    // Create confirmed membership
    const { data: membership, error: mErr } = await supabase
      .from('team_memberships')
      .insert({
        student_id,
        team_id,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        created_by: user.id,
      })
      .select()
      .single();

    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 });

    await supabase.from('audit_logs').insert({
      action: 'admin_reassign',
      performed_by: user.id,
      target_student_id: student_id,
      target_team_id: team_id,
      details: { student_name: student.full_name, team_name: team.name, note: 'إلحاق مباشر بواسطة المشرف' },
    });

    return NextResponse.json({ success: true, membership });
  }

  // 2. REMOVE student from team
  if (action === 'remove') {
    const memId = membership_id;
    if (!memId) {
      return NextResponse.json({ error: 'membership_id_required' }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from('team_memberships')
      .select('*, student:students(full_name), team:teams(name)')
      .eq('id', memId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'membership_not_found' }, { status: 404 });
    }

    const { error: remErr } = await supabase
      .from('team_memberships')
      .update({
        status: 'removed',
        removed_at: new Date().toISOString(),
        removed_by: user.id,
        removal_reason: 'إزالة بواسطة المشرف',
      })
      .eq('id', memId);

    if (remErr) return NextResponse.json({ error: remErr.message }, { status: 400 });

    // Revoke any pending invitations
    await supabase
      .from('team_invitations')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('membership_id', memId)
      .eq('status', 'pending');

    await supabase.from('audit_logs').insert({
      action: 'membership_remove',
      performed_by: user.id,
      target_student_id: membership.student_id,
      target_team_id: membership.team_id,
      details: { student_name: (membership.student as any)?.full_name, team_name: (membership.team as any)?.name },
    });

    return NextResponse.json({ success: true });
  }

  // 3. MOVE student between teams
  if (action === 'move') {
    if (!student_id || !to_team_id) {
      return NextResponse.json({ error: 'student_and_destination_team_required' }, { status: 400 });
    }

    const { data: student } = await supabase.from('students').select('*').eq('id', student_id).single();
    const { data: toTeam } = await supabase.from('teams').select('*').eq('id', to_team_id).single();

    if (!student || !toTeam) {
      return NextResponse.json({ error: 'student_or_team_not_found' }, { status: 404 });
    }

    if (student.academic_group_id !== toTeam.academic_group_id) {
      return NextResponse.json({ error: 'academic_group_mismatch' }, { status: 400 });
    }

    // Check capacity of toTeam
    const { count: confirmedCount } = await supabase
      .from('team_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', to_team_id)
      .eq('status', 'confirmed');

    if ((confirmedCount || 0) >= toTeam.max_capacity) {
      return NextResponse.json({ error: 'destination_team_at_capacity' }, { status: 400 });
    }

    // Remove old active membership if from_team_id provided or find it
    if (from_team_id) {
      await supabase
        .from('team_memberships')
        .update({ status: 'removed', removed_at: new Date().toISOString(), removed_by: user.id })
        .eq('student_id', student_id)
        .eq('team_id', from_team_id)
        .in('status', ['confirmed', 'invitation_pending']);
    } else {
      await supabase
        .from('team_memberships')
        .update({ status: 'removed', removed_at: new Date().toISOString(), removed_by: user.id })
        .eq('student_id', student_id)
        .in('status', ['confirmed', 'invitation_pending']);
    }

    // Create new confirmed membership in destination team
    const { data: newMem, error: insertErr } = await supabase
      .from('team_memberships')
      .insert({
        student_id,
        team_id: to_team_id,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        created_by: user.id,
      })
      .select()
      .single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 400 });

    await supabase.from('audit_logs').insert({
      action: 'admin_reassign',
      performed_by: user.id,
      target_student_id: student_id,
      target_team_id: to_team_id,
      details: {
        student_name: student.full_name,
        from_team_id,
        to_team_id,
        to_team_name: toTeam.name,
      },
    });

    return NextResponse.json({ success: true, membership: newMem });
  }

  // 4. CHANGE CAPACITY
  if (action === 'change_capacity') {
    if (!team_id || !capacity || capacity < 1) {
      return NextResponse.json({ error: 'invalid_capacity' }, { status: 400 });
    }

    const { data: team, error: tErr } = await supabase
      .from('teams')
      .update({ max_capacity: Number(capacity) })
      .eq('id', team_id)
      .select()
      .single();

    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 400 });

    await supabase.from('audit_logs').insert({
      action: 'capacity_change',
      performed_by: user.id,
      target_team_id: team_id,
      new_values: { max_capacity: Number(capacity) },
    });

    return NextResponse.json({ success: true, team });
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
}
