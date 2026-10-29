import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { normalizeArabicName } from '@/lib/utils';

// POST /api/admin/students/import
export async function POST(request: NextRequest) {
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json();
  const { students, resolve_duplicates = 'skip' } = body;

  if (!Array.isArray(students) || students.length === 0) {
    return NextResponse.json({ error: 'no_students_provided' }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const batchId = crypto.randomUUID();

  const results = {
    imported: 0,
    skipped: 0,
    updated: 0,
    errors: [] as { name: string; error: string }[],
  };

  for (const student of students) {
    try {
      const studentData = {
        full_name: student.full_name?.trim(),
        email: student.email?.trim() || null,
        phone: student.phone?.trim() || null,
        academic_group_id: student.academic_group_id,
        import_batch_id: batchId,
        created_by: user.id,
      };

      if (!studentData.full_name || !studentData.academic_group_id) {
        results.errors.push({ name: student.full_name || '???', error: 'missing_required_fields' });
        continue;
      }

      // Check for duplicate by name and academic group
      const { data: existing } = await supabase
        .from('students')
        .select('id, full_name')
        .eq('academic_group_id', studentData.academic_group_id)
        .eq('full_name', studentData.full_name)
        .maybeSingle();

      if (existing) {
        if (resolve_duplicates === 'skip') {
          results.skipped++;
          continue;
        } else if (resolve_duplicates === 'update') {
          await supabase.from('students').update(studentData).eq('id', existing.id);
          results.updated++;
        } else {
          results.errors.push({ name: studentData.full_name, error: 'duplicate' });
        }
        continue;
      }

      const { error } = await supabase.from('students').insert(studentData);
      if (error) {
        results.errors.push({ name: studentData.full_name, error: error.message });
      } else {
        results.imported++;
      }
    } catch (err) {
      results.errors.push({ name: student.full_name || '???', error: 'unknown_error' });
    }
  }

  await supabase.from('audit_logs').insert({
    action: 'student_import',
    performed_by: user.id,
    details: {
      batch_id: batchId,
      imported: results.imported,
      skipped: results.skipped,
      updated: results.updated,
      errors: results.errors.length,
    },
  });

  return NextResponse.json({ results, batch_id: batchId });
}
