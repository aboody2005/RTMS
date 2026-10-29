import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createAdminClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/auth/login', request.url));
}
