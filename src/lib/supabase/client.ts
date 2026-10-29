'use client';

import { createBrowserClient } from '@supabase/ssr';

const DEFAULT_SUPABASE_URL = 'https://vpzzczdgebiatuukcszf.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwenpjemRnZWJpYXR1dWtjc3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMTc5NjEsImV4cCI6MjEwODc5Mzk2MX0.qhwNwCG1K-Vp_TV1oxegNJP2RydFos-bOqDsITlswYo';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY
  );
}
