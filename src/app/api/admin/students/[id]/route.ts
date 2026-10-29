import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

// PATCH /api/admin/students/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json();
  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from('students')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from('audit_logs').insert({
    action: 'student_update',
    performed_by: user.id,
    target_student_id: id,
    new_values: { name: data.full_name },
  });

  return NextResponse.json({ student: data });
}

// DELETE /api/admin/students/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = await createAdminClient();

  // Check if student is confirmed in a team
  const { count } = await supabase
    .from('team_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', id)
    .eq('status', 'confirmed');

  if (count && count > 0) {
    return NextResponse.json({ error: 'student_has_confirmed_membership' }, { status: 409 });
  }

  const { error } = await supabase
    .from('students')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from('audit_logs').insert({
    action: 'student_delete',
    performed_by: user.id,
    target_student_id: id,
  });

  return NextResponse.json({ success: true });
}
