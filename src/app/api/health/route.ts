import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT_SET',
    hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    isServiceRoleKeyDifferentFromAnon:
      process.env.SUPABASE_SERVICE_ROLE_KEY !== process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    database: {
      connected: false,
      tables: {} as Record<string, any>,
    },
  };

  // 1. Test Admin Client Connection (Service Role)
  try {
    const adminSupabase = await createAdminClient();
    
    // Check academic_groups
    const { data: groups, error: groupsErr, count: groupsCount } = await adminSupabase
      .from('academic_groups')
      .select('id, name', { count: 'exact' });

    if (groupsErr) {
      diagnostics.database.tables['academic_groups'] = {
        status: 'error',
        code: groupsErr.code,
        message: groupsErr.message,
      };
    } else {
      diagnostics.database.connected = true;
      diagnostics.database.tables['academic_groups'] = {
        status: 'ok',
        count: groupsCount,
        sample: groups?.slice(0, 3).map((g) => g.name),
      };
    }

    // Check teams
    const { error: teamsErr, count: teamsCount } = await adminSupabase
      .from('teams')
      .select('id', { count: 'exact', head: true });

    diagnostics.database.tables['teams'] = teamsErr
      ? { status: 'error', message: teamsErr.message }
      : { status: 'ok', count: teamsCount };

    // Check students
    const { error: studentsErr, count: studentsCount } = await adminSupabase
      .from('students')
      .select('id', { count: 'exact', head: true });

    diagnostics.database.tables['students'] = studentsErr
      ? { status: 'error', message: studentsErr.message }
      : { status: 'ok', count: studentsCount };

    // Check profiles
    const { error: profilesErr, count: profilesCount } = await adminSupabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    diagnostics.database.tables['profiles'] = profilesErr
      ? { status: 'error', message: profilesErr.message }
      : { status: 'ok', count: profilesCount };

  } catch (err: any) {
    diagnostics.database.error = err.message;
  }

  const isFullyConfigured =
    diagnostics.database.connected &&
    diagnostics.isServiceRoleKeyDifferentFromAnon &&
    diagnostics.database.tables['academic_groups']?.status === 'ok';

  return NextResponse.json({
    status: isFullyConfigured ? 'HEALTHY' : 'SETUP_REQUIRED',
    diagnostics,
    instruction: isFullyConfigured
      ? 'Database is fully connected and ready to use!'
      : 'Please execute supabase/complete_database_setup.sql in the Supabase SQL editor and update SUPABASE_SERVICE_ROLE_KEY in .env.local',
  });
}
