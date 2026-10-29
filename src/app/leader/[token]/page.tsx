'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { Card, Button, useToast } from '@/components/ui';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getCleanTeamName, rebaseAppUrl, copyToClipboard } from '@/lib/utils';
import styles from './leader.module.css';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function LeaderPortalPage({ params }: PageProps) {
  const { token } = use(params);
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaderData, setLeaderData] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [availableStudents, setAvailableStudents] = useState<any[]>([]);
  const [allGroupStudents, setAllGroupStudents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'available'>('all');

  // Multi-select action states
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);
  const [newInvites, setNewInvites] = useState<any[]>([]);

  // Fetch leader dashboard data
  const loadLeaderData = useCallback(async () => {
    try {
      const res = await fetch(`/api/leader/actions?token=${token}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error === 'invalid_or_revoked_token'
            ? 'رابط الدخول غير صالح أو تم إلغاؤه من قبل المشرف'
            : 'فشل في تحميل بيانات الفريق'
        );
      }

      setLeaderData(data);
      setMembers(data.memberships || []);
      setInvitations(data.invitations || []);
      setAvailableStudents(data.availableStudents || []);
      setAllGroupStudents(data.allGroupStudents || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadLeaderData();
  }, [loadLeaderData]);

  const team = leaderData?.team;
  const maxCapacity = team?.max_capacity || 6;
  const confirmedMembers = members.filter((m) => m.status === 'confirmed');
  const remainingSlots = Math.max(0, maxCapacity - confirmedMembers.length);
  const isFull = confirmedMembers.length >= maxCapacity;
  const percentage = Math.min(100, Math.round((confirmedMembers.length / maxCapacity) * 100));
  
  // Clean team name preventing duplicate group name rendering
  const cleanTeamName = getCleanTeamName(team?.name, team?.academic_group?.name);

  // Toggle student selection for multi-invite
  const toggleStudentSelection = (studentId: string, isAvailable: boolean) => {
    if (!isAvailable) return;

    setSelectedStudentIds((prev) => {
      if (prev.includes(studentId)) {
        return prev.filter((id) => id !== studentId);
      } else {
        if (prev.length >= remainingSlots) {
          toast.error(`لا يمكن اختيار أكثر من ${remainingSlots} طلاب (حسب المقاعد الشاغرة المتبقية)`);
          return prev;
        }
        return [...prev, studentId];
      }
    });
  };

  // Remove single student from selection
  const removeSelectedStudent = (studentId: string) => {
    setSelectedStudentIds((prev) => prev.filter((id) => id !== studentId));
  };

  // Clear all selected students
  const clearSelection = () => {
    setSelectedStudentIds([]);
  };

  // Submit invitations (batch or single)
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudentIds.length === 0) {
      toast.error('يرجى اختيار طالب واحد على الأقل لإرسال الدعوة');
      return;
    }

    if (selectedStudentIds.length > remainingSlots) {
      toast.error(`العدد المحدد (${selectedStudentIds.length}) يتجاوز الأماكن الشاغرة (${remainingSlots})`);
      return;
    }

    setInviting(true);
    setNewInvites([]);
    try {
      const res = await fetch('/api/leader/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'invite',
          student_ids: selectedStudentIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(
          data.message ||
          (data.error === 'team_at_capacity'
            ? 'الفريق مكتمل العدد بالفعل'
            : 'فشل في إنشاء الدعوات')
        );
        return;
      }

      const generated = data.invitations || (data.invitation_url ? [{ student_name: data.student_name, invitation_url: data.invitation_url }] : []);
      const normalizedInvites = generated.map((inv: any) => ({
        ...inv,
        invitation_url: rebaseAppUrl(inv.invitation_url),
      }));
      setNewInvites(normalizedInvites);
      toast.success(data.message || `تم إنشاء ${normalizedInvites.length} دعوة بنجاح!`);
      setSelectedStudentIds([]);
      loadLeaderData();
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ في الاتصال بالخادم');
    } finally {
      setInviting(false);
    }
  };

  // Revoke invitation
  const handleRevoke = async (invitationId: string) => {
    if (!confirm('هل تريد إلغاء هذه الدعوة؟')) return;

    try {
      const res = await fetch('/api/leader/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'revoke',
          invitation_id: invitationId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'فشل في إلغاء الدعوة');
        return;
      }

      toast.success('تم إلغاء الدعوة بنجاح');
      loadLeaderData();
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء إلغاء الدعوة');
    }
  };

  // Remove confirmed member
  const handleRemove = async (membershipId: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في إزالة هذا الطالب من الفريق؟')) return;

    try {
      const res = await fetch('/api/leader/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'remove',
          membership_id: membershipId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'فشل في إزالة العضو');
        return;
      }

      toast.success('تمت إزالة الطالب من الفريق');
      loadLeaderData();
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء إزالة الطالب');
    }
  };

  if (loading) {
    return (
      <div className={styles.pageWrapper} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }} />
          <p style={{ marginTop: '1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>جاري تسجيل الدخول كقائد فريق...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.pageWrapper} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <Card style={{ maxWidth: '440px', textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚫</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>تعذر الوصول</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>{error}</p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            إعادة المحاولة
          </Button>
        </Card>
      </div>
    );
  }

  // Filter students based on search and tab selection
  const activeStudentList = filterTab === 'available' ? availableStudents : allGroupStudents;
  const filteredStudents = activeStudentList.filter((s: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    return s.full_name?.toLowerCase().includes(q);
  });

  return (
    <div className={styles.pageWrapper}>
      
      {/* 1. Header Area - Displays Clean Team & Group Name once without repetition */}
      <header className={styles.header}>
        <div className={styles.headerContainer}>
          <div className={styles.headerTop}>
            
            {/* Brand / Title / Rabbit Logo */}
            <div className={styles.brandGroup}>
              <span className={styles.brandIcon} aria-hidden="true">🐇</span>
              <div className={styles.brandInfo}>
                <h1 className={styles.brandTitle}>بوابة قائد الفريق</h1>
                <p className={styles.brandSubtitle}>مختبر علم الأدوية العملي • كلية الصيدلة</p>
                <div className={styles.teamTagRow}>
                  {/* Clean team name and single group name display */}
                  <span>{cleanTeamName} — المجموعة {team?.academic_group?.name}</span>
                  {team?.rabbit_number && <span>| أرنب {team.rabbit_number}</span>}
                </div>
              </div>
            </div>

            {/* Theme Toggle (نهاري / ليلي) */}
            <div className={styles.themeToggleWrapper}>
              <ThemeToggle />
            </div>
          </div>

          {/* Full-width dark capacity pill bar */}
          <div className={styles.headerCapacityBar}>
            <div className={styles.headerCapacityRight}>
              <span className={styles.headerCapacityLabel}>السعة المكتملة</span>
              <span className={styles.headerCapacityCount}>
                {confirmedMembers.length} من {maxCapacity} طلاب
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Content Area */}
      <main className={styles.mainContainer}>

        {/* 3. Top Capacity Stats Progress Card */}
        <section className={styles.capacityStatsCard} aria-label="حالة اكتمال الفريق">
          <div className={styles.capacityStatsTop}>
            <div className={styles.capacityRateLabel}>
              <span>نسبة اكتمال الفريق:</span>
              <span className={styles.capacityConfirmedText}>{confirmedMembers.length} مؤكد</span>
            </div>

            <div className={styles.capacityMaxStats}>
              <span className={styles.capacityRatio}>{maxCapacity} / {confirmedMembers.length}</span>
              <span className={styles.capacityMaxLabel}>{maxCapacity} كحد أقصى</span>
            </div>
          </div>

          {/* Green Progress Bar */}
          <div className={styles.progressTrack} role="progressbar" aria-valuenow={confirmedMembers.length} aria-valuemin={0} aria-valuemax={maxCapacity}>
            <div
              className={styles.progressFill}
              style={{ width: `${percentage}%` }}
            />
          </div>

          <div className={styles.capacityStatsBottom}>
            <span className={styles.remainingBadge}>
              <span>🟢</span>
              <span>متبقي {remainingSlots} أماكن شاغرة</span>
            </span>

            {invitations.length > 0 && (
              <span className={styles.pendingBadge}>
                🟡 {invitations.length} دعوة بانتظار التأكيد
              </span>
            )}
          </div>
        </section>

        {/* 4. Two-Column RTL Grid */}
        <div className={styles.dashboardGrid}>

          {/* RIGHT COLUMN (in RTL): Confirmed Team Members */}
          <section className={styles.sectionCard} aria-labelledby="confirmed-members-heading">
            <div className={styles.sectionHeader}>
              <h2 id="confirmed-members-heading" className={styles.sectionTitle}>
                <span style={{ color: '#818cf8' }}>👥</span>
                <span>أعضاء الفريق المؤكدون ({confirmedMembers.length})</span>
              </h2>
            </div>

            <div className={styles.memberList}>
              {confirmedMembers.map((m) => (
                <div key={m.id} className={styles.memberItem}>
                  <div className={styles.memberStart}>
                    {/* Crown Avatar for Leader, Student Icon for Members */}
                    <div className={m.is_leader ? styles.leaderAvatar : styles.studentAvatar}>
                      {m.is_leader ? '👑' : '👨‍🎓'}
                    </div>

                    <div className={styles.memberDetails}>
                      <div className={styles.memberNameRow}>
                        <span className={styles.memberName}>{m.student?.full_name}</span>
                        {m.is_leader && (
                          <span className={styles.leaderBadge}>
                            أنت (القائد)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {!m.is_leader && (
                    <button
                      type="button"
                      onClick={() => handleRemove(m.id)}
                      className={styles.removeMemberBtn}
                      title="إزالة من الفريق"
                    >
                      إزالة
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Pending Invitations list if any */}
            {invitations.length > 0 && (
              <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle} style={{ fontSize: '0.875rem', color: '#facc15' }}>
                    <span>✉️</span>
                    <span>الدعوات المرسلة بانتظار التأكيد ({invitations.length})</span>
                  </h3>
                </div>

                <div className={styles.memberList} style={{ marginTop: '0.75rem' }}>
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className={styles.memberItem}
                      style={{ backgroundColor: 'rgba(234, 179, 8, 0.08)', borderColor: 'rgba(234, 179, 8, 0.2)' }}
                    >
                      <div className={styles.memberStart}>
                        <div className={styles.studentAvatar} style={{ fontSize: '1rem' }}>✉️</div>
                        <span className={styles.memberName} style={{ fontSize: '0.85rem' }}>{inv.student?.full_name}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRevoke(inv.id)}
                        className={styles.removeMemberBtn}
                        style={{ color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.3)', backgroundColor: 'rgba(251, 191, 36, 0.1)' }}
                        title="إلغاء الدعوة"
                      >
                        إلغاء
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* LEFT COLUMN (in RTL): Searchable Multi-Select Student Invitation Roster */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <section className={styles.sectionCard} aria-labelledby="invite-teammate-heading">
              <div className={styles.sectionHeader}>
                <h2 id="invite-teammate-heading" className={styles.sectionTitle}>
                  <span className={styles.sectionTitlePurple}>+</span>
                  <span>دعوة زميل إلى الفريق</span>
                </h2>
              </div>

              <p className={styles.sectionSubtitle}>
                اختر طالباً أو أكثر من طلاب <strong>المجموعة {team?.academic_group?.name}</strong> لتوليد روابط دعوة فورية وإرسالها لهم.
              </p>

              {isFull ? (
                <div style={{ padding: '1rem', backgroundColor: '#1e293b', borderRadius: '10px', textAlign: 'center', fontSize: '0.8125rem', color: '#94a3b8' }}>
                  لا يمكنك إرسال دعوات جديدة لأن الفريق قد اكتمل بالكامل ({maxCapacity} طلاب).
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  
                  {/* Search Input Filter */}
                  <input
                    type="text"
                    placeholder="🔍 ابحث بالاسم في قائمة الطلاب..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={styles.searchInput}
                  />

                  {/* Filter Tabs: Defaults to ALL students belonging to the group */}
                  <div className={styles.tabsContainer} role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={filterTab === 'all'}
                      onClick={() => setFilterTab('all')}
                      className={`${styles.tabBtn} ${filterTab === 'all' ? styles.tabBtnActive : ''}`}
                    >
                      جميع طلاب المجموعة ({allGroupStudents.length})
                    </button>

                    <button
                      type="button"
                      role="tab"
                      aria-selected={filterTab === 'available'}
                      onClick={() => setFilterTab('available')}
                      className={`${styles.tabBtn} ${filterTab === 'available' ? styles.tabBtnActive : ''}`}
                    >
                      متاحون فقط ({availableStudents.length})
                    </button>
                  </div>

                  {/* Multi-Selection Summary & Chips Bar */}
                  {selectedStudentIds.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div className={styles.selectionHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.78125rem', fontWeight: 700, color: '#f8fafc' }}>
                            الطلاب المختارون:
                          </span>
                          <span className={styles.selectedCountBadge}>
                            {selectedStudentIds.length} من {remainingSlots} مقاعد شاغرة
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={clearSelection}
                          className={styles.clearSelectionBtn}
                        >
                          إلغاء التحديد
                        </button>
                      </div>

                      {/* Chips of selected students */}
                      <div className={styles.chipsContainer}>
                        {selectedStudentIds.map((id) => {
                          const student = allGroupStudents.find((s: any) => s.id === id);
                          if (!student) return null;
                          return (
                            <span key={id} className={styles.studentChip}>
                              <span>{student.full_name}</span>
                              <button
                                type="button"
                                onClick={() => removeSelectedStudent(id)}
                                className={styles.chipRemoveBtn}
                                title="إزالة من التحديد"
                              >
                                ✕
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Complete, Unrestricted Student Roster (All Students of Group) */}
                  <form onSubmit={handleInviteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className={styles.selectLabel} style={{ margin: 0 }}>
                        اختر الطلاب من قائمة المجموعة ({filteredStudents.length} طالب):
                      </label>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                        {selectedStudentIds.length > 0 ? `تم تحديد ${selectedStudentIds.length}` : 'انقر على الطالب لتحديده'}
                      </span>
                    </div>

                    {filteredStudents.length === 0 ? (
                      <div style={{ padding: '1.5rem', textAlign: 'center', backgroundColor: '#090e1a', borderRadius: '8px', color: '#94a3b8', fontSize: '0.8125rem' }}>
                        لا توجد نتائج بحث مطابقة للاسم المدخل
                      </div>
                    ) : (
                      <div className={styles.studentScrollContainer} style={{ maxHeight: '340px' }}>
                        {filteredStudents.map((s: any) => {
                          const isAvailable = s.is_available;
                          const isSelected = selectedStudentIds.includes(s.id);

                          return (
                            <div
                              key={s.id}
                              onClick={() => toggleStudentSelection(s.id, isAvailable)}
                              className={`${styles.studentCard} ${isSelected ? styles.studentCardSelected : ''} ${!isAvailable ? styles.studentCardDisabled : ''}`}
                              title={
                                !isAvailable
                                  ? s.status_label
                                  : isSelected
                                  ? 'انقر لإلغاء التحديد'
                                  : 'انقر لتحديد الطالب'
                              }
                            >
                              {/* Right side: Checkbox + Student Name */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                <div
                                  className={`${styles.studentCheckbox} ${isSelected ? styles.studentCheckboxChecked : ''} ${!isAvailable ? styles.studentCheckboxDisabled : ''}`}
                                >
                                  {isSelected && <span style={{ fontSize: '0.75rem', lineHeight: 1 }}>✓</span>}
                                </div>
                                <span className={styles.studentCardName}>{s.full_name}</span>
                              </div>

                              {/* Left side: Clear Status Badges */}
                              <div>
                                {isAvailable ? (
                                  <span className={styles.badgeAvailable}>
                                    متاح
                                  </span>
                                ) : s.status_code === 'pending_this_team' ? (
                                  <span className={styles.badgePendingThisTeam}>
                                    دعوة معلقة
                                  </span>
                                ) : s.status_code === 'pending_other_team' ? (
                                  <span className={styles.badgePendingOtherTeam}>
                                    دعوة لفريق آخر
                                  </span>
                                ) : (
                                  <span className={styles.badgeJoined} title={s.status_label}>
                                    {s.confirmed_team_name ? `منضم إلى ${getCleanTeamName(s.confirmed_team_name)}` : 'منضم لفريق'}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={inviting || selectedStudentIds.length === 0}
                      className={styles.submitInviteBtn}
                    >
                      {inviting
                        ? 'جاري إنشاء الدعوات وتوليد الروابط...'
                        : selectedStudentIds.length === 0
                        ? 'حدد طالباً أو أكثر لإرسال الدعوة'
                        : selectedStudentIds.length === 1
                        ? '✉️ إرسال الدعوة وتوليد الرابط (طالب واحد)'
                        : `✉️ إرسال الدعوات وتوليد الروابط (${selectedStudentIds.length} طلاب)`}
                    </button>
                  </form>
                </div>
              )}

              {/* Newly Generated Invites Result Box (Supports Multi & Single) */}
              {newInvites.length > 0 && (
                <div className={styles.inviteResultBox}>
                  <p className={styles.inviteSuccessTitle}>
                    ✅ تم إنشاء {newInvites.length} رابط دعوة بنجاح!
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
                    {newInvites.map((inv, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.4rem',
                          padding: '0.75rem',
                          backgroundColor: '#0a1f14',
                          border: '1px solid #166534',
                          borderRadius: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#86efac' }}>
                            {inv.student_name}
                          </span>
                        </div>

                        <div className={styles.inviteUrlInputRow}>
                          <input
                            type="text"
                            readOnly
                            value={rebaseAppUrl(inv.invitation_url)}
                            className={styles.inviteUrlInput}
                            onFocus={(e) => e.target.select()}
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const targetUrl = rebaseAppUrl(inv.invitation_url);
                              const ok = await copyToClipboard(targetUrl);
                              if (ok) {
                                toast.success(`تم نسخ رابط "${inv.student_name}" بنجاح!`);
                              } else {
                                toast.error('تعذر نسخ الرابط تلقائياً، يرجى تحديده ونسخه يدوياً');
                              }
                            }}
                            className={styles.copyUrlBtn}
                          >
                            نسخ
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Experiment Guidelines */}
            <section className={styles.guidelinesBox}>
              <h4 className={styles.guidelinesTitle}>
                <span>📋</span> تعليمات تجارب الأرانب العملية
              </h4>
              <ul className={styles.guidelinesList}>
                <li>الالتزام بارتداء المعطف المخبري (Lab Coat) والقفازات الواقية طوال فترة التجربة.</li>
                <li>قائد الفريق مسؤول عن استلام وتسليم الأدوات والحيوان المخبري من الفني المختص.</li>
                <li>التعامل برفق مع حيوانات التجارب والالتزام بالقواعد الأخلاقية والمهنية.</li>
                <li>تسجيل جميع القياسات والجرعات بدقة في تقرير التجربة الجماعي.</li>
              </ul>
            </section>
          </div>

        </div>
      </main>
    </div>
  );
}
