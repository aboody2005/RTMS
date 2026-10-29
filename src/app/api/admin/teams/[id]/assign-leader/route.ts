import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { generateSecureToken, hashToken, buildLeaderUrl } from '@/lib/utils';

// POST /api/admin/teams/[id]/assign-leader
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: team_id } = await params;
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized', message: 'غير مصرح بالوصول' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json', message: 'طلب غير صالح' }, { status: 400 });
  }

  const { student_id } = body;
  if (!student_id) {
    return NextResponse.json({ error: 'student_id_required', message: 'يرجى اختيار طالب لتعيينه قائداً' }, { status: 400 });
  }

  const supabase = await createAdminClient();

  // 1. Verify team exists
  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .select('id, name, academic_group_id')
    .eq('id', team_id)
    .single();

  if (teamErr || !team) {
    return NextResponse.json({ error: 'not_found', message: 'الفريق غير موجود' }, { status: 404 });
  }

  // 2. Verify student exists and belongs to the team's academic group
  const { data: student, error: studentErr } = await supabase
    .from('students')
    .select('id, academic_group_id, full_name, is_active')
    .eq('id', student_id)
    .single();

  if (studentErr || !student) {
    return NextResponse.json({ error: 'student_not_found', message: 'الطالب غير موجود' }, { status: 404 });
  }

  if (team.academic_group_id !== student.academic_group_id) {
    return NextResponse.json({
      error: 'group_mismatch',
      message: 'الطالب لا ينتمي إلى نفس المجموعة الدراسية للفريق'
    }, { status: 400 });
  }

  // 3. Find any existing leader currently assigned to this team
  const { data: currentLeaderRecord } = await supabase
    .from('team_leaders')
    .select('id, student_id')
    .eq('team_id', team_id)
    .maybeSingle();

  const previousLeaderStudentId = currentLeaderRecord?.student_id;

  // 4. If this new student was previously assigned as leader in ANY OTHER team,
  // remove that old record so unique_student_as_leader constraint is never violated
  await supabase
    .from('team_leaders')
    .delete()
    .eq('student_id', student_id)
    .neq('team_id', team_id);

  // Also remove is_leader status for this student from any other teams
  await supabase
    .from('team_memberships')
    .update({ is_leader: false })
    .eq('student_id', student_id)
    .neq('team_id', team_id);

  // 5. If changing from a previous leader on this team, revoke their leader role in team_memberships
  // (Preserves their membership in the team as a regular member without deleting student/account records)
  if (previousLeaderStudentId && previousLeaderStudentId !== student_id) {
    await supabase
      .from('team_memberships')
      .update({ is_leader: false })
      .eq('team_id', team_id)
      .eq('student_id', previousLeaderStudentId);
  }

  // 6. Generate fresh secure access token for the leader
  const token = generateSecureToken(48);
  const tokenHash = hashToken(token);
  const tokenPrefix = token.substring(0, 8);

  // 7. Update or Insert the team_leaders record
  // (Prevents "duplicate key value violates unique constraint 'unique_leader_per_team'")
  let leaderRecord: any;

  if (currentLeaderRecord) {
    // Existing leader row exists for this team -> UPDATE it
    const { data: updatedLeader, error: updateErr } = await supabase
      .from('team_leaders')
      .update({
        student_id,
        access_token_hash: tokenHash,
        access_token_prefix: tokenPrefix,
        is_active: true,
        link_revoked_at: null,
        updated_at: new Date().toISOString(),
        created_by: user.id,
      })
      .eq('id', currentLeaderRecord.id)
      .select()
      .single();

    if (updateErr) {
      console.error('Update leader error:', updateErr);
      return NextResponse.json({
        error: updateErr.message,
        message: 'فشل في تحديث بيانات قائد الفريق'
      }, { status: 400 });
    }
    leaderRecord = updatedLeader;
  } else {
    // No leader row exists for this team yet -> INSERT
    const { data: insertedLeader, error: insertErr } = await supabase
      .from('team_leaders')
      .insert({
        team_id,
        student_id,
        access_token_hash: tokenHash,
        access_token_prefix: tokenPrefix,
        is_active: true,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Insert leader error:', insertErr);
      return NextResponse.json({
        error: insertErr.message,
        message: 'فشل في إنشاء قائد الفريق'
      }, { status: 400 });
    }
    leaderRecord = insertedLeader;
  }

  // 8. Update team_memberships for the NEW leader:
  // Check if they already have a membership in this team
  const { data: existingMemberInThisTeam } = await supabase
    .from('team_memberships')
    .select('id, status, is_leader')
    .eq('team_id', team_id)
    .eq('student_id', student_id)
    .maybeSingle();

  if (!existingMemberInThisTeam) {
    // Add as confirmed team member with is_leader = true
    await supabase.from('team_memberships').insert({
      team_id,
      student_id,
      status: 'confirmed',
      is_leader: true,
      confirmed_at: new Date().toISOString(),
      created_by: user.id,
    });
  } else {
    // Ensure status is confirmed and is_leader = true
    await supabase.from('team_memberships')
      .update({
        status: 'confirmed',
        is_leader: true,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', existingMemberInThisTeam.id);
  }

  // 9. Mark any pending invitations for the new leader in this team as confirmed
  await supabase
    .from('team_invitations')
    .update({ status: 'confirmed' })
    .eq('team_id', team_id)
    .eq('student_id', student_id)
    .eq('status', 'pending');

  // 10. Audit log
  await supabase.from('audit_logs').insert({
    action: 'leader_assign',
    performed_by: user.id,
    target_team_id: team_id,
    target_student_id: student_id,
    details: {
      team_name: team.name,
      student_name: student.full_name,
      previous_leader_student_id: previousLeaderStudentId || null,
    },
  });

  const leaderUrl = buildLeaderUrl(token, request);

  return NextResponse.json({
    success: true,
    leader: leaderRecord,
    token,
    leader_url: leaderUrl,
    message: 'تم تعيين وتحديث قائد الفريق بنجاح!',
  }, { status: 200 });
}

// PUT /api/admin/teams/[id]/assign-leader (Regenerate link for active leader)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: team_id } = await params;
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized', message: 'غير مصرح' }, { status: 401 });

  const supabase = await createAdminClient();

  const { data: leader } = await supabase
    .from('team_leaders')
    .select('id, student_id, student:students(full_name)')
    .eq('team_id', team_id)
    .eq('is_active', true)
    .maybeSingle();

  if (!leader) {
    return NextResponse.json({
      error: 'no_active_leader',
      message: 'لا يوجد قائد مفعل حالياً لهذا الفريق، يرجى تعيين قائد أولاً'
    }, { status: 404 });
  }

  const token = generateSecureToken(48);
  const tokenHash = hashToken(token);

  const { error } = await supabase
    .from('team_leaders')
    .update({
      access_token_hash: tokenHash,
      access_token_prefix: token.substring(0, 8),
      link_revoked_at: null,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leader.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from('audit_logs').insert({
    action: 'leader_link_generate',
    performed_by: user.id,
    target_team_id: team_id,
    target_student_id: leader.student_id,
  });

  return NextResponse.json({
    success: true,
    token,
    leader_url: buildLeaderUrl(token, request),
    message: 'تم إعادة توليد رابط القائد بنجاح!',
  });
}
