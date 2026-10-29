import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

// POST /api/admin/invitations/[id]/revoke
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = await createAdminClient();

  // Get invitation
  const { data: invitation } = await supabase
    .from('team_invitations')
    .select('*')
    .eq('id', id)
    .single();

  if (!invitation) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (invitation.status !== 'pending') {
    return NextResponse.json({ error: 'cannot_revoke_non_pending' }, { status: 400 });
  }

  // Revoke invitation
  await supabase.from('team_invitations')
    .update({ status: 'revoked', revoked_at: new Date().toISOString(), revoked_by: user.id })
    .eq('id', id);

  // Update membership status
  await supabase.from('team_memberships')
    .update({ status: 'revoked' })
    .eq('id', invitation.membership_id);

  await supabase.from('audit_logs').insert({
    action: 'invitation_revoke',
    performed_by: user.id,
    target_student_id: invitation.student_id,
    target_team_id: invitation.team_id,
  });

  return NextResponse.json({ success: true });
}
