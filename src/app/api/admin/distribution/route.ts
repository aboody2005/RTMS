import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

// POST /api/admin/distribution - Random distribution
export async function POST(request: NextRequest) {
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json();
  const { academic_group_id, student_ids, distribute_all = true, auto_confirm = false, preview = false } = body;

  if (!academic_group_id) {
    return NextResponse.json({ error: 'group_required' }, { status: 400 });
  }

  const supabase = await createAdminClient();

  // If preview, just calculate without inserting
  if (preview) {
    // Get confirmed students
    const { data: confirmed } = await supabase
      .from('team_memberships')
      .select('student_id')
      .eq('status', 'confirmed');

    const confirmedIds = new Set((confirmed || []).map((m: { student_id: string }) => m.student_id));

    // Get group students and filter unassigned
    const { data: allGroupStudents } = await supabase
      .from('students')
      .select('id, full_name')
      .eq('academic_group_id', academic_group_id)
      .eq('is_active', true);

    const unassigned = (allGroupStudents || []).filter((s: { id: string }) => !confirmedIds.has(s.id));

    // Get teams with available slots
    const { data: teams } = await supabase
      .from('teams')
      .select(`
        id, name, max_capacity,
        memberships:team_memberships(status)
      `)
      .eq('academic_group_id', academic_group_id)
      .eq('is_active', true);

    const teamsWithSlots = (teams || []).map(team => {
      const confirmed = (team.memberships as { status: string }[])?.filter(m => m.status === 'confirmed').length || 0;
      return {
        id: team.id,
        name: team.name,
        max_capacity: team.max_capacity,
        confirmed,
        available_slots: Math.max(0, team.max_capacity - confirmed),
      };
    }).filter(t => t.available_slots > 0);

    const totalSlots = teamsWithSlots.reduce((sum, t) => sum + t.available_slots, 0);
    const studentList = (student_ids || (unassigned || []).map((s: { id: string }) => s.id));

    return NextResponse.json({
      preview: true,
      unassigned_students: unassigned || [],
      teams_with_slots: teamsWithSlots,
      total_available_slots: totalSlots,
      students_to_distribute: Math.min(studentList.length, totalSlots),
      students_remaining_after: Math.max(0, studentList.length - totalSlots),
    });
  }

  // Get student IDs to distribute
  let studentIdsToDistribute = student_ids;
  if (distribute_all || !studentIdsToDistribute?.length) {
    const { data: unassigned } = await supabase
      .from('students')
      .select('id')
      .eq('academic_group_id', academic_group_id)
      .eq('is_active', true);

    // Filter out already confirmed
    const { data: confirmed } = await supabase
      .from('team_memberships')
      .select('student_id')
      .eq('status', 'confirmed');

    const confirmedIds = new Set((confirmed || []).map((m: { student_id: string }) => m.student_id));
    studentIdsToDistribute = (unassigned || [])
      .filter((s: { id: string }) => !confirmedIds.has(s.id))
      .map((s: { id: string }) => s.id);
  }

  if (!studentIdsToDistribute?.length) {
    return NextResponse.json({
      success: true,
      distributed: 0,
      remaining_unassigned: 0,
      message: 'لا يوجد طلاب لتوزيعهم',
    });
  }

  // Call atomic distribution function
  const { data, error } = await supabase.rpc('random_distribute_students', {
    p_group_id: academic_group_id,
    p_student_ids: studentIdsToDistribute,
    p_auto_confirm: auto_confirm,
    p_performed_by: user.id,
  });

  if (error) {
    console.error('Distribution error:', error);
    return NextResponse.json({ error: 'server_error', details: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
