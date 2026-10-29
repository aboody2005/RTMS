import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { generateSecureToken, hashToken, buildLeaderUrl } from '@/lib/utils';

// POST /api/admin/teams/[id]/assign-leader
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: team_id } = await params;
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json();
  const { student_id } = body;
  const supabase = await createAdminClient();

  // Verify student belongs to team's group
  const { data: team } = await supabase
    .from('teams')
    .select('academic_group_id')
    .eq('id', team_id)
    .single();

  const { data: student } = await supabase
    .from('students')
    .select('academic_group_id, full_name')
    .eq('id', student_id)
    .single();

  if (!team || !student) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (team.academic_group_id !== student.academic_group_id) {
    return NextResponse.json({ error: 'group_mismatch' }, { status: 400 });
  }

  // Deactivate existing leader if any
  await supabase
    .from('team_leaders')
    .update({ is_active: false, link_revoked_at: new Date().toISOString() })
    .eq('team_id', team_id)
    .eq('is_active', true);

  // Generate secure token
  const token = generateSecureToken(48);
  const tokenHash = hashToken(token);

  // Create new leader record
  const { data: leader, error } = await supabase
    .from('team_leaders')
    .insert({
      team_id,
      student_id,
      access_token_hash: tokenHash,
      access_token_prefix: token.substring(0, 8),
      is_active: true,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Also add as team member if not already
  const { data: existingMember } = await supabase
    .from('team_memberships')
    .select('id, status')
    .eq('team_id', team_id)
    .eq('student_id', student_id)
    .single();

  if (!existingMember) {
    await supabase.from('team_memberships').insert({
      team_id,
      student_id,
      status: 'confirmed',
      is_leader: true,
      confirmed_at: new Date().toISOString(),
      created_by: user.id,
    });
  } else if (existingMember.status !== 'confirmed') {
    await supabase.from('team_memberships')
      .update({ status: 'confirmed', is_leader: true, confirmed_at: new Date().toISOString() })
      .eq('id', existingMember.id);
  } else {
    await supabase.from('team_memberships')
      .update({ is_leader: true })
      .eq('id', existingMember.id);
  }

  await supabase.from('audit_logs').insert({
    action: 'leader_assign',
    performed_by: user.id,
    target_team_id: team_id,
    target_student_id: student_id,
    details: { student_name: student.full_name },
  });

  const leaderUrl = buildLeaderUrl(token, request);

  return NextResponse.json({
    leader,
    token,
    leader_url: leaderUrl,
  }, { status: 201 });
}

// POST /api/admin/teams/[id]/generate-leader-link
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: team_id } = await params;
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = await createAdminClient();

  const { data: leader } = await supabase
    .from('team_leaders')
    .select('id, student_id, students:students(full_name)')
    .eq('team_id', team_id)
    .eq('is_active', true)
    .single();

  if (!leader) return NextResponse.json({ error: 'no_active_leader' }, { status: 404 });

  const token = generateSecureToken(48);
  const tokenHash = hashToken(token);

  const { error } = await supabase
    .from('team_leaders')
    .update({
      access_token_hash: tokenHash,
      access_token_prefix: token.substring(0, 8),
      link_revoked_at: null,
    })
    .eq('id', leader.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from('audit_logs').insert({
    action: 'leader_link_generate',
    performed_by: user.id,
    target_team_id: team_id,
    target_student_id: leader.student_id,
  });

  return NextResponse.json({ token, leader_url: buildLeaderUrl(token, request) });
}
