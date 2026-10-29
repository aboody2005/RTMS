import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

// GET /api/admin/groups/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from('academic_groups')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ group: data });
}

// PATCH /api/admin/groups/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json();
  const supabase = await createAdminClient();

  const { data: prev } = await supabase.from('academic_groups').select('*').eq('id', id).single();
  const { data, error } = await supabase
    .from('academic_groups')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from('audit_logs').insert({
    action: 'group_update',
    performed_by: user.id,
    target_group_id: id,
    previous_values: prev,
    new_values: data,
  });

  return NextResponse.json({ group: data });
}

// DELETE /api/admin/groups/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = await createAdminClient();

  // Safety check: no active students
  const { count } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('academic_group_id', id)
    .eq('is_active', true);

  if (count && count > 0) {
    return NextResponse.json(
      { error: 'cannot_delete_group_with_students', count },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from('academic_groups')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from('audit_logs').insert({
    action: 'group_delete',
    performed_by: user.id,
    target_group_id: id,
  });

  return NextResponse.json({ success: true });
}
