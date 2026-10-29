import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminShell } from '@/components/admin/AdminShell';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'لوحة التحكم - نظام إدارة فرق تجارب الأرانب',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Get admin profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    redirect('/auth/login?error=unauthorized');
  }

  return (
    <AdminShell adminName={profile.full_name}>
      {children}
    </AdminShell>
  );
}
