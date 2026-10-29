import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { hashToken } from '@/lib/utils';

// GET /api/confirm-invitation?token=xxx
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'missing_token' }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const tokenHash = hashToken(token);

  const { data: invitation, error } = await supabase
    .from('team_invitations')
    .select(`
      *,
      student:students(id, full_name, academic_group_id, academic_group:academic_groups(name)),
      team:teams(id, name, max_capacity, academic_group_id, academic_group:academic_groups(name),
        team_leader:team_leaders(student:students(full_name))
      ),
      membership:team_memberships(status, is_leader)
    `)
    .eq('token_hash', tokenHash)
    .single();

  if (error || !invitation) {
    return NextResponse.json({ error: 'invitation_not_found' }, { status: 404 });
  }

  if (invitation.status !== 'pending') {
    return NextResponse.json({ error: `invitation_${invitation.status}`, invitation }, { status: 200 });
  }

  // Get current confirmed members of this team
  const { data: members } = await supabase
    .from('team_memberships')
    .select('student:students(full_name), is_leader, status')
    .eq('team_id', invitation.team_id)
    .eq('status', 'confirmed');

  return NextResponse.json({
    invitation,
    members: members || [],
  });
}

// POST /api/confirm-invitation
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { token } = body;

  if (!token) {
    return NextResponse.json({ error: 'missing_token' }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const tokenHash = hashToken(token);

  // Call the atomic PostgreSQL function
  const { data, error } = await supabase.rpc('confirm_student_invitation', {
    p_token_hash: tokenHash,
  });

  if (error) {
    console.error('Confirm invitation error:', error);
    return NextResponse.json({
      error: 'server_error',
      message: 'حدث خطأ في الخادم أثناء معالجة تأكيد الدعوة',
    }, { status: 500 });
  }

  if (!data || !data.success) {
    const errorKey = data?.error || 'confirmation_failed';
    const errorMap: Record<string, string> = {
      'invitation_not_found': 'رابط الدعوة غير صحيح أو غير موجود',
      'invitation_expired': 'انتهت صلاحية هذا الرابط',
      'invitation_already_used': 'تم استخدام هذا الرابط وتأكيد العضوية مسبقاً',
      'invitation_revoked': 'تم إلغاء رابط الدعوة هذا من قبل قائد الفريق',
      'team_at_capacity': 'عذراً، اكتملت السعة القصوى لهذا الفريق',
      'student_already_confirmed': 'أنت منضم بالفعل إلى فريق آخر في هذه المجموعة الدراسية',
    };
    return NextResponse.json({
      error: errorKey,
      message: errorMap[errorKey] || 'فشل تأكيد الانضمام للفريق',
    }, { status: 400 });
  }

  // Log audit
  await supabase.from('audit_logs').insert({
    action: 'membership_confirm',
    performed_by_name: data.student_name,
    target_team_id: data.team_id,
    details: { student_name: data.student_name, team_name: data.team_name },
  });

  return NextResponse.json({ success: true, data });
}
