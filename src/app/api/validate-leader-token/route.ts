import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { hashToken } from '@/lib/utils';

// Validate a team leader access token
// GET /api/validate-leader-token?token=xxx
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'missing_token' }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const tokenHash = hashToken(token);

  const { data: leader, error } = await supabase
    .from('team_leaders')
    .select(`
      *,
      student:students(id, full_name, academic_group_id),
      team:teams(
        id, name, max_capacity,
        academic_group:academic_groups(id, name),
        memberships:team_memberships(
          id, status, is_leader, confirmed_at,
          student:students(id, full_name)
        )
      )
    `)
    .eq('access_token_hash', tokenHash)
    .eq('is_active', true)
    .single();

  if (error || !leader) {
    return NextResponse.json({ error: 'leader_not_found' }, { status: 404 });
  }

  if (leader.link_revoked_at) {
    return NextResponse.json({ error: 'link_revoked' }, { status: 403 });
  }

  return NextResponse.json({ leader });
}
