import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

// GET /api/admin/teams/bulk-capacity - Preview which teams will be affected and detect conflicts
export async function GET(request: NextRequest) {
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope') || 'group';
  const groupId = searchParams.get('group_id');
  const newCapacity = Number(searchParams.get('new_capacity')) || 6;

  const supabase = await createAdminClient();

  let query = supabase
    .from('teams')
    .select(`
      id,
      name,
      max_capacity,
      academic_group_id,
      academic_group:academic_groups(id, name),
      memberships:team_memberships(id, status)
    `)
    .eq('is_active', true);

  if (scope === 'group' && groupId) {
    query = query.eq('academic_group_id', groupId);
  }

  const { data: teams, error } = await query.order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const analyzedTeams = (teams || []).map((t: any) => {
    const confirmedCount = (t.memberships || []).filter((m: any) => m.status === 'confirmed').length;
    const hasConflict = confirmedCount > newCapacity;
    return {
      id: t.id,
      name: t.name,
      current_capacity: t.max_capacity,
      new_capacity: newCapacity,
      group_name: t.academic_group?.name || '',
      confirmed_count: confirmedCount,
      has_conflict: hasConflict,
    };
  });

  const eligibleTeams = analyzedTeams.filter(t => !t.has_conflict);
  const conflictTeams = analyzedTeams.filter(t => t.has_conflict);

  return NextResponse.json({
    total_teams: analyzedTeams.length,
    eligible_teams_count: eligibleTeams.length,
    conflict_teams_count: conflictTeams.length,
    eligible_teams: eligibleTeams,
    conflict_teams: conflictTeams,
    new_capacity: newCapacity,
  });
}

// POST /api/admin/teams/bulk-capacity - Execute bulk capacity update
export async function POST(request: NextRequest) {
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json();
  const { scope = 'group', group_id, new_capacity, exclude_conflicts = true } = body;

  const targetCapacity = Number(new_capacity);
  if (!targetCapacity || targetCapacity < 2 || targetCapacity > 30) {
    return NextResponse.json({
      error: 'invalid_capacity',
      message: 'يرجى إدخال سعة صحيحة بين 2 و 30 طالباً.'
    }, { status: 400 });
  }

  const supabase = await createAdminClient();

  let query = supabase
    .from('teams')
    .select(`
      id,
      name,
      max_capacity,
      academic_group_id,
      academic_group:academic_groups(id, name),
      memberships:team_memberships(id, status)
    `)
    .eq('is_active', true);

  if (scope === 'group') {
    if (!group_id) {
      return NextResponse.json({ error: 'missing_group_id', message: 'يرجى تحديد المجموعة الدراسية المراد تحديث فرقها.' }, { status: 400 });
    }
    query = query.eq('academic_group_id', group_id);
  }

  const { data: teams, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!teams || teams.length === 0) {
    return NextResponse.json({
      error: 'no_teams_found',
      message: 'لم يتم العثور على أي فرق في النطاق المحدد.'
    }, { status: 404 });
  }

  // Analyze conflicts
  const analyzed = teams.map((t: any) => {
    const confirmedCount = (t.memberships || []).filter((m: any) => m.status === 'confirmed').length;
    const hasConflict = confirmedCount > targetCapacity;
    return {
      id: t.id,
      name: t.name,
      confirmed_count: confirmedCount,
      has_conflict: hasConflict,
    };
  });

  const eligibleTeams = analyzed.filter(t => !t.has_conflict);
  const conflictTeams = analyzed.filter(t => t.has_conflict);

  if (conflictTeams.length > 0 && !exclude_conflicts) {
    return NextResponse.json({
      error: 'has_conflicts',
      message: `يوجد ${conflictTeams.length} فرق تضم أعضاء مؤكدين أكثر من السعة الجديدة المطلوبة (${targetCapacity}). يرجى استثناء هذه الفرق أو إعادة توزيع الطلاب أولاً.`,
      conflict_teams: conflictTeams,
    }, { status: 409 });
  }

  if (eligibleTeams.length === 0) {
    return NextResponse.json({
      error: 'no_eligible_teams',
      message: 'لا توجد فرق مؤهلة للتحديث؛ كافة الفرق المحددة تضم طلاباً أكثر من السعة المطلوبة.',
      conflict_teams: conflictTeams,
    }, { status: 400 });
  }

  const eligibleIds = eligibleTeams.map(t => t.id);

  // Apply update to Supabase
  const { error: updateError } = await supabase
    .from('teams')
    .update({
      max_capacity: targetCapacity,
      updated_at: new Date().toISOString(),
    })
    .in('id', eligibleIds);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log in audit_logs
  await supabase.from('audit_logs').insert({
    action: 'capacity_change',
    performed_by: user.id,
    target_group_id: scope === 'group' ? group_id : null,
    new_values: {
      scope,
      new_capacity: targetCapacity,
      updated_count: eligibleTeams.length,
      skipped_count: conflictTeams.length,
      updated_team_ids: eligibleIds,
      skipped_teams: conflictTeams,
    },
  });

  return NextResponse.json({
    success: true,
    updated_count: eligibleTeams.length,
    skipped_count: conflictTeams.length,
    updated_teams: eligibleTeams,
    skipped_teams: conflictTeams,
    new_capacity: targetCapacity,
    message: conflictTeams.length > 0
      ? `تم تحديث سعة ${eligibleTeams.length} فرق بنجاح إلى ${targetCapacity} طلاب، وتم تخطي ${conflictTeams.length} فرق لاحتوائها على طلاب مؤكدين أكثر من السعة الجديدة.`
      : `تم تحديث سعة ${eligibleTeams.length} فرق بنجاح إلى ${targetCapacity} طلاب.`,
  });
}
