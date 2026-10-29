import { createClient } from '@/lib/supabase/server';
import { StatsCard, Card, PageHeader, CapacityBar } from '@/components/ui';
import Link from 'next/link';
import styles from './dashboard.module.css';

export default async function AdminDashboard() {
  const supabase = await createClient();

  // Fetch all stats in parallel
  const [
    { count: totalStudents },
    { count: totalGroups },
    { count: totalTeams },
    { count: totalLeaders },
    { count: confirmedStudents },
    { count: pendingStudents },
    { data: recentAudit },
    { data: teamsData },
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('academic_groups').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('teams').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('team_leaders').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('team_memberships').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
    supabase.from('team_memberships').select('*', { count: 'exact', head: true }).eq('status', 'invitation_pending'),
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(8),
    supabase.from('teams')
      .select(`
        id, name, max_capacity,
        academic_group:academic_groups(name),
        team_leader:team_leaders(
          student:students(full_name)
        ),
        memberships:team_memberships(status)
      `)
      .eq('is_active', true)
      .limit(8),
  ]);

  const unassignedStudents = Math.max(0, (totalStudents || 0) - (confirmedStudents || 0) - (pendingStudents || 0));

  // Calculate total available slots
  const availableSlots = (teamsData || []).reduce((acc, team) => {
    const confirmed = (team.memberships as { status: string }[])?.filter(m => m.status === 'confirmed').length || 0;
    return acc + Math.max(0, team.max_capacity - confirmed);
  }, 0);

  const getAuditActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      student_import: 'استيراد طلاب',
      student_create: 'إضافة طالب',
      student_update: 'تعديل طالب',
      student_delete: 'حذف طالب',
      group_create: 'إنشاء مجموعة',
      group_update: 'تعديل مجموعة',
      team_create: 'إنشاء فريق',
      team_update: 'تعديل فريق',
      leader_assign: 'تعيين قائد',
      leader_link_generate: 'توليد رابط قائد',
      leader_link_revoke: 'إلغاء رابط قائد',
      invitation_create: 'إنشاء دعوة',
      invitation_revoke: 'إلغاء دعوة',
      membership_confirm: 'تأكيد انضمام',
      membership_remove: 'إزالة عضو',
      random_distribution: 'توزيع عشوائي',
      admin_reassign: 'إعادة توزيع إداري',
    };
    return labels[action] || action;
  };

  return (
    <div>
      <PageHeader
        title="لوحة التحكم"
        subtitle="نظام إدارة فرق مختبر علم الأدوية العملي — كلية الصيدلة"
        breadcrumb={[{ label: 'الرئيسية' }]}
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Link
              href="/admin/distribution"
              className="btn btn-sm"
              style={{ backgroundColor: 'var(--purple-bg)', color: 'var(--purple-text)', border: '1px solid var(--purple-border)' }}
            >
              <span>🎲</span>
              <span>توزيع عشوائي</span>
            </Link>
            <Link
              href="/admin/export"
              className="btn btn-sm"
              style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }}
            >
              <span>📊</span>
              <span>تصدير Excel</span>
            </Link>
          </div>
        }
      />

      {/* 8 Stats Cards Grid (Responsive up to 2K/4K displays) */}
      <div className={styles.statsGrid}>
        <StatsCard
          title="إجمالي الطلاب"
          value={totalStudents || 0}
          icon={<span>👨‍🎓</span>}
          color="blue"
        />
        <StatsCard
          title="المجموعات الدراسية"
          value={totalGroups || 0}
          icon={<span>🎓</span>}
          color="indigo"
        />
        <StatsCard
          title="الفرق النشطة"
          value={totalTeams || 0}
          icon={<span>👥</span>}
          color="purple"
        />
        <StatsCard
          title="قادة الفرق"
          value={totalLeaders || 0}
          icon={<span>👑</span>}
          color="yellow"
        />
        <StatsCard
          title="طلاب مؤكدون"
          value={confirmedStudents || 0}
          icon={<span>✅</span>}
          color="green"
        />
        <StatsCard
          title="في انتظار التأكيد"
          value={pendingStudents || 0}
          icon={<span>⏳</span>}
          color="yellow"
        />
        <StatsCard
          title="طلاب غير موزعين"
          value={unassignedStudents}
          icon={<span>👤</span>}
          color="red"
        />
        <StatsCard
          title="أماكن متاحة"
          value={availableSlots}
          icon={<span>🪑</span>}
          color="blue"
        />
      </div>

      {/* Two Column Section: Teams Overview & Recent Audit */}
      <div className={styles.dashboardCols}>

        {/* Teams Overview */}
        <Card>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>حالة الفرق المختبرية</h3>
            <Link href="/admin/teams" className={styles.cardActionLink}>
              عرض كافة الفرق ←
            </Link>
          </div>

          <div className={styles.teamsList}>
            {(teamsData || []).slice(0, 6).map((team: any) => {
              const memberships = Array.isArray(team.memberships) ? team.memberships : [];
              const confirmed = memberships.filter((m: any) => m.status === 'confirmed').length;
              const pending = memberships.filter((m: any) => m.status === 'invitation_pending').length;
              const groupName = Array.isArray(team.academic_group)
                ? team.academic_group[0]?.name
                : team.academic_group?.name;
              const leaderObj = Array.isArray(team.team_leader) ? team.team_leader[0] : team.team_leader;
              const leaderStudentName = Array.isArray(leaderObj?.student)
                ? leaderObj?.student[0]?.full_name
                : leaderObj?.student?.full_name;

              return (
                <div key={team.id} className={styles.teamItem}>
                  <div className={styles.teamItemHeader}>
                    <div>
                      <p className={styles.teamName}>{team.name}</p>
                      <p className={styles.teamMeta}>
                        {groupName}
                        {leaderStudentName ? ` • القائد: ${leaderStudentName}` : ''}
                      </p>
                    </div>
                    <span className={styles.teamCount}>
                      {confirmed} / {team.max_capacity}
                    </span>
                  </div>
                  <CapacityBar confirmed={confirmed} max={team.max_capacity} pending={pending} />
                </div>
              );
            })}
            {!teamsData?.length && (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>🐇</p>
                <p style={{ fontSize: '0.875rem' }}>لا توجد فرق مضافة بعد</p>
              </div>
            )}
          </div>
        </Card>

        {/* Recent Audit Operations */}
        <Card>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>آخر العمليات بالنظام</h3>
            <Link href="/admin/audit" className={styles.cardActionLink}>
              السجل الكامل ←
            </Link>
          </div>

          <div className={styles.auditList}>
            {(recentAudit || []).map((log) => (
              <div key={log.id} className={styles.auditItem}>
                <div className={styles.auditIcon}>
                  📋
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className={styles.auditAction}>{getAuditActionLabel(log.action)}</p>
                  <p className={styles.auditMeta}>
                    {log.performed_by_name || 'النظام'} •{' '}
                    {new Date(log.created_at).toLocaleDateString('ar-SA', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
            {!recentAudit?.length && (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>📜</p>
                <p style={{ fontSize: '0.875rem' }}>لا توجد عمليات مسجلة حتى الآن</p>
              </div>
            )}
          </div>
        </Card>

      </div>

      {/* Quick Actions Bar */}
      <Card>
        <h3 className={styles.cardTitle} style={{ marginBottom: 'var(--space-4)' }}>الإجراءات السريعة</h3>
        <div className={styles.quickActionsGrid}>
          {[
            { href: '/admin/groups', icon: '🎓', label: 'المجموعات' },
            { href: '/admin/students', icon: '👨‍🎓', label: 'الطلاب' },
            { href: '/admin/import', icon: '📥', label: 'استيراد Excel' },
            { href: '/admin/teams', icon: '🐇', label: 'الفرق' },
            { href: '/admin/distribution', icon: '🎲', label: 'توزيع عشوائي' },
            { href: '/admin/export', icon: '📊', label: 'تصدير التقارير' },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={styles.quickActionCard}
            >
              <span className={styles.quickActionIcon}>{action.icon}</span>
              <span className={styles.quickActionLabel}>{action.label}</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
