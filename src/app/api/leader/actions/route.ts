import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { hashToken, generateSecureToken, buildInvitationUrl, getCleanTeamName } from '@/lib/utils';

// Helper to validate leader token and return leader info + team
async function validateLeader(supabase: any, token: string) {
  if (!token) return null;
  const tokenHash = hashToken(token);

  const { data: leader, error } = await supabase
    .from('team_leaders')
    .select(`
      id, team_id, student_id, is_active, link_revoked_at,
      student:students(id, full_name, academic_group_id),
      team:teams(
        id, name, max_capacity, academic_group_id,
        academic_group:academic_groups(id, name)
      )
    `)
    .eq('access_token_hash', tokenHash)
    .eq('is_active', true)
    .is('link_revoked_at', null)
    .single();

  if (error || !leader) return null;
  return leader;
}

// GET /api/leader/actions?token=xxx
// Returns team details, confirmed members, pending invitations, and available students in the group
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'missing_token', message: 'رمز الدخول مطلوب' }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const leader = await validateLeader(supabase, token);

  if (!leader) {
    return NextResponse.json({ error: 'invalid_or_revoked_token', message: 'رابط القائد غير صالح أو تم إلغاؤه' }, { status: 403 });
  }

  // 1. Fetch team members (confirmed and pending)
  const { data: memberships } = await supabase
    .from('team_memberships')
    .select(`
      id, status, is_leader, confirmed_at, created_at,
      student:students(id, full_name)
    `)
    .eq('team_id', leader.team_id)
    .in('status', ['confirmed', 'invitation_pending'])
    .order('is_leader', { ascending: false })
    .order('created_at', { ascending: true });

  // 2. Fetch pending invitations for this team
  const { data: invitations } = await supabase
    .from('team_invitations')
    .select(`
      id, student_id, status, created_at, expires_at,
      student:students(id, full_name)
    `)
    .eq('team_id', leader.team_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  // 3. Fetch all students in the same academic group with accurate status indicators
  const groupName = leader.team?.academic_group?.name || '';
  const { data: membershipsInGroup } = await supabase
    .from('team_memberships')
    .select('student_id, status, team_id, team:teams(name)')
    .in('status', ['confirmed', 'invitation_pending'])
    .range(0, 9999);

  const confirmedMap = new Map<string, string>();
  const pendingMap = new Map<string, { team_id: string; team_name: string }>();

  (membershipsInGroup || []).forEach((m: any) => {
    const rawTeamName = m.team?.name;
    const cleanName = rawTeamName ? getCleanTeamName(rawTeamName, groupName) : 'فريق آخر';

    if (m.status === 'confirmed') {
      confirmedMap.set(m.student_id, cleanName);
    } else if (m.status === 'invitation_pending') {
      pendingMap.set(m.student_id, {
        team_id: m.team_id,
        team_name: cleanName,
      });
    }
  });

  // Fetch every single student in this academic group without pagination capping
  const { data: groupStudents, error: studentsError } = await supabase
    .from('students')
    .select('id, full_name, academic_group_id, is_active')
    .eq('academic_group_id', leader.team.academic_group_id)
    .order('full_name')
    .range(0, 9999);

  if (studentsError) {
    console.error('Error fetching group students:', studentsError);
  }

  // Deduplicate and enrich every student with clear availability and team status
  const uniqueStudentsMap = new Map<string, any>();

  (groupStudents || []).forEach((s: any) => {
    if (!uniqueStudentsMap.has(s.id)) {
      const isConfirmed = confirmedMap.has(s.id);
      const confirmedTeam = confirmedMap.get(s.id);
      const pendingInfo = pendingMap.get(s.id);

      let statusLabel = 'متاح';
      let statusCode = 'available';

      if (isConfirmed) {
        statusLabel = confirmedTeam ? `منضم إلى ${confirmedTeam}` : 'منضم لفريق';
        statusCode = 'confirmed';
      } else if (pendingInfo) {
        if (pendingInfo.team_id === leader.team_id) {
          statusLabel = 'دعوة معلقة لهذا الفريق';
          statusCode = 'pending_this_team';
        } else {
          statusLabel = pendingInfo.team_name ? `دعوة معلقة لـ ${pendingInfo.team_name}` : 'دعوة معلقة لفريق آخر';
          statusCode = 'pending_other_team';
        }
      }

      uniqueStudentsMap.set(s.id, {
        id: s.id,
        full_name: s.full_name,
        is_available: !isConfirmed && !pendingInfo,
        is_confirmed: isConfirmed,
        confirmed_team_name: confirmedTeam || null,
        pending_team_id: pendingInfo?.team_id || null,
        status_code: statusCode,
        status_label: statusLabel,
      });
    }
  });

  const allGroupStudents = Array.from(uniqueStudentsMap.values());
  const availableStudents = allGroupStudents.filter((s: any) => s.is_available);

  return NextResponse.json({
    leader,
    team: leader.team,
    memberships: memberships || [],
    invitations: invitations || [],
    availableStudents,
    allGroupStudents,
  });
}

// POST /api/leader/actions
// Handles leader operations: invite, revoke, remove
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json', message: 'طلب غير صالح' }, { status: 400 });
  }

  const { token, action, student_id, student_ids, invitation_id, membership_id } = body;

  if (!token) {
    return NextResponse.json({ error: 'missing_token', message: 'رمز الدخول مطلوب' }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const leader = await validateLeader(supabase, token);

  if (!leader) {
    return NextResponse.json({ error: 'invalid_or_revoked_token', message: 'رابط القائد غير صالح أو تم إلغاؤه' }, { status: 403 });
  }

  // Action: Invite student (supports single student_id or array of student_ids)
  if (action === 'invite') {
    const rawIds: string[] = Array.isArray(student_ids) && student_ids.length > 0
      ? student_ids
      : student_id ? [student_id] : [];

    // Filter out duplicates and empty strings
    const targetStudentIds = Array.from(new Set(rawIds.filter(Boolean)));

    if (targetStudentIds.length === 0) {
      return NextResponse.json({ error: 'student_id_required', message: 'يرجى اختيار طالب واحد على الأقل لإرسال الدعوة' }, { status: 400 });
    }

    // Check team capacity
    const { count: confirmedCount } = await supabase
      .from('team_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', leader.team_id)
      .eq('status', 'confirmed');

    const currentConfirmed = confirmedCount || 0;
    const remainingSlots = Math.max(0, leader.team.max_capacity - currentConfirmed);

    if (remainingSlots <= 0) {
      return NextResponse.json({ error: 'team_at_capacity', message: 'الفريق مكتمل السعة القصوى بالفعل' }, { status: 400 });
    }

    if (targetStudentIds.length > remainingSlots) {
      return NextResponse.json({
        error: 'exceeds_capacity',
        message: `عدد الطلاب المحددين (${targetStudentIds.length}) يتجاوز المقاعد المتاحة في الفريق (${remainingSlots})`
      }, { status: 400 });
    }

    const createdInvitations: any[] = [];
    const errors: string[] = [];

    for (const sid of targetStudentIds) {
      // 1. Verify student exists and belongs to the same academic group
      const { data: student } = await supabase
        .from('students')
        .select('id, academic_group_id, full_name, is_active')
        .eq('id', sid)
        .single();

      if (!student || student.academic_group_id !== leader.team.academic_group_id) {
        errors.push(`الطالب غير موجود أو لا ينتمي إلى نفس المجموعة الدراسية`);
        continue;
      }

      // 2. Check if student is already confirmed in any team
      const { data: alreadyConfirmed } = await supabase
        .from('team_memberships')
        .select('id, team:teams(name)')
        .eq('student_id', student.id)
        .eq('status', 'confirmed')
        .maybeSingle();

      if (alreadyConfirmed) {
        errors.push(`الطالب "${student.full_name}" منضم بالفعل لفريق آخر`);
        continue;
      }

      // 3. Check if student already has a pending invitation for this team
      const { data: alreadyPending } = await supabase
        .from('team_memberships')
        .select('id')
        .eq('student_id', student.id)
        .eq('team_id', leader.team_id)
        .eq('status', 'invitation_pending')
        .maybeSingle();

      if (alreadyPending) {
        errors.push(`توجد دعوة معلقة بالفعل للطالب "${student.full_name}" في هذا الفريق`);
        continue;
      }

      // 4. Generate secure token
      const inviteToken = generateSecureToken(48);
      const tokenHash = hashToken(inviteToken);
      const tokenPrefix = inviteToken.slice(0, 8);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // 5. Create membership record
      const { data: newMembership, error: membershipErr } = await supabase
        .from('team_memberships')
        .insert({
          student_id: student.id,
          team_id: leader.team_id,
          status: 'invitation_pending',
          is_leader: false,
          created_by: null,
        })
        .select('id')
        .single();

      if (membershipErr || !newMembership) {
        console.error('Membership create error:', membershipErr);
        errors.push(`فشل في إنشاء عضوية للطالب "${student.full_name}"`);
        continue;
      }

      // 6. Create invitation record
      const { data: newInvite, error: inviteErr } = await supabase
        .from('team_invitations')
        .insert({
          membership_id: newMembership.id,
          student_id: student.id,
          team_id: leader.team_id,
          token_hash: tokenHash,
          token_prefix: tokenPrefix,
          status: 'pending',
          expires_at: expiresAt,
          created_by: null,
        })
        .select('id')
        .single();

      if (inviteErr || !newInvite) {
        console.error('Invitation create error:', inviteErr);
        await supabase.from('team_memberships').delete().eq('id', newMembership.id);
        errors.push(`فشل في إنشاء دعوة للطالب "${student.full_name}"`);
        continue;
      }

      const invitationUrl = buildInvitationUrl(inviteToken, request);
      createdInvitations.push({
        student_id: student.id,
        student_name: student.full_name,
        invitation_url: invitationUrl,
      });

      await supabase.from('audit_logs').insert({
        action: 'invitation_create',
        performed_by_name: `قائد الفريق (${leader.student?.full_name})`,
        target_student_id: student.id,
        target_team_id: leader.team_id,
        details: { student_name: student.full_name, team_name: leader.team.name },
      });
    }

    if (createdInvitations.length === 0) {
      return NextResponse.json({
        error: 'invitation_failed',
        message: errors.join(' • ') || 'فشل في إنشاء الدعوات للطلاب المحددين'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      invitations: createdInvitations,
      count: createdInvitations.length,
      student_name: createdInvitations[0].student_name,
      invitation_url: createdInvitations[0].invitation_url,
      message: `تم إنشاء ${createdInvitations.length} دعوة بنجاح!`,
    });
  }



  // Action: Revoke invitation
  if (action === 'revoke') {
    if (!invitation_id) {
      return NextResponse.json({ error: 'invitation_id_required', message: 'معرف الدعوة مطلوب' }, { status: 400 });
    }

    const { data: invite } = await supabase
      .from('team_invitations')
      .select('id, student_id, team_id, status')
      .eq('id', invitation_id)
      .eq('team_id', leader.team_id)
      .single();

    if (!invite) {
      return NextResponse.json({ error: 'invitation_not_found', message: 'لم يتم العثور على الدعوة' }, { status: 404 });
    }

    await supabase
      .from('team_invitations')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', invitation_id);

    await supabase
      .from('team_memberships')
      .update({ status: 'revoked' })
      .eq('team_id', leader.team_id)
      .eq('student_id', invite.student_id)
      .eq('status', 'invitation_pending');

    await supabase.from('audit_logs').insert({
      action: 'invitation_revoke',
      performed_by_name: `قائد الفريق (${leader.student?.full_name})`,
      target_team_id: leader.team_id,
      target_student_id: invite.student_id,
    });

    return NextResponse.json({ success: true, message: 'تم إلغاء الدعوة بنجاح' });
  }

  // Action: Remove confirmed member (cannot remove leader self)
  if (action === 'remove') {
    if (!membership_id) {
      return NextResponse.json({ error: 'membership_id_required', message: 'معرف العضوية مطلوب' }, { status: 400 });
    }

    const { data: member } = await supabase
      .from('team_memberships')
      .select('id, student_id, is_leader, student:students(full_name)')
      .eq('id', membership_id)
      .eq('team_id', leader.team_id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'member_not_found', message: 'لم يتم العثور على العضو' }, { status: 404 });
    }

    if (member.is_leader) {
      return NextResponse.json({ error: 'cannot_remove_leader', message: 'لا يمكن للقائد إزالة نفسه من الفريق' }, { status: 400 });
    }

    await supabase
      .from('team_memberships')
      .update({ status: 'removed' })
      .eq('id', membership_id);

    await supabase.from('audit_logs').insert({
      action: 'membership_remove',
      performed_by_name: `قائد الفريق (${leader.student?.full_name})`,
      target_team_id: leader.team_id,
      target_student_id: member.student_id,
      details: { student_name: (member.student as any)?.full_name },
    });

    return NextResponse.json({ success: true, message: 'تمت إزالة الطالب من الفريق' });
  }

  return NextResponse.json({ error: 'invalid_action', message: 'إجراء غير مدعوم' }, { status: 400 });
}
