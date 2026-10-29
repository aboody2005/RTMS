import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { generateSecureToken, hashToken, buildInvitationUrl } from '@/lib/utils';

// POST /api/admin/invitations - Create invitation (admin or can be extended for leaders)
export async function POST(request: NextRequest) {
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json();
  const { student_id, team_id } = body;

  const supabase = await createAdminClient();

  // Generate token
  const token = generateSecureToken(48);

  // Call atomic DB function
  const { data, error } = await supabase.rpc('add_student_to_team', {
    p_student_id: student_id,
    p_team_id: team_id,
    p_created_by: user.id,
    p_token: token,
  });

  if (error) {
    console.error('Add student error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  if (!data.success) {
    return NextResponse.json({ error: data.error }, { status: 400 });
  }

  await supabase.from('audit_logs').insert({
    action: 'invitation_create',
    performed_by: user.id,
    target_student_id: student_id,
    target_team_id: team_id,
  });

  const invitationUrl = buildInvitationUrl(token, request);

  return NextResponse.json({
    success: true,
    token,
    invitation_url: invitationUrl,
    membership_id: data.membership_id,
  }, { status: 201 });
}

// GET /api/admin/invitations
export async function GET(request: NextRequest) {
  const teamId = request.nextUrl.searchParams.get('team_id');
  const status = request.nextUrl.searchParams.get('status');
  const supabase = await createAdminClient();

  let query = supabase
    .from('team_invitations')
    .select(`
      *,
      student:students(id, full_name, student_id, academic_group:academic_groups(name)),
      team:teams(id, name, academic_group:academic_groups(name))
    `)
    .order('created_at', { ascending: false });

  if (teamId) query = query.eq('team_id', teamId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ invitations: data || [] });
}
