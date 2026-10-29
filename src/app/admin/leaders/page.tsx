'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  PageHeader, Card, Button, Modal, Badge, EmptyState,
  TableWrapper, Th, Td, ConfirmDialog, useToast
} from '@/components/ui';
import { Input, Select } from '@/components/ui/Input';
import { rebaseAppUrl, copyToClipboard } from '@/lib/utils';
import type { AcademicGroup } from '@/types';

export default function LeadersPage() {
  const { toast } = useToast();
  const [teams, setTeams] = useState<any[]>([]);
  const [groups, setGroups] = useState<AcademicGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Reassign modal state
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [activeTeam, setActiveTeam] = useState<any | null>(null);
  const [groupStudents, setGroupStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch groups
  useEffect(() => {
    fetch('/api/admin/groups')
      .then(res => res.json())
      .then(data => setGroups(data.groups || []))
      .catch(console.error);
  }, []);

  // Fetch teams with leaders
  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const url = selectedGroup ? `/api/admin/teams?group_id=${selectedGroup}` : '/api/admin/teams';
      const res = await fetch(url);
      const data = await res.json();
      setTeams(data.teams || []);
    } catch (err) {
      console.error(err);
      toast.error('فشل في تحميل بيانات قادة الفرق');
    } finally {
      setLoading(false);
    }
  }, [selectedGroup, toast]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Regenerate link
  const handleRegenerateLink = async (team: any) => {
    try {
      const res = await fetch(`/api/admin/teams/${team.id}/assign-leader`, {
        method: 'PUT',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل في إعادة توليد الرابط');

      const targetUrl = rebaseAppUrl(data.leader_url);
      await copyToClipboard(targetUrl);
      toast.success(`تم توليد رابط جديد لقائد "${team.name}" ونسخه إلى الحافظة!`);
      fetchTeams();
    } catch (err: any) {
      toast.error(err.message || 'فشل في إعادة توليد الرابط');
    }
  };

  // Open Reassign Modal
  const openReassignModal = async (team: any) => {
    setActiveTeam(team);
    setSelectedStudentId('');
    setGeneratedUrl(null);
    setReassignModalOpen(true);

    try {
      const res = await fetch(`/api/admin/students?group_id=${team.academic_group_id}&pageSize=500&page_size=500`);
      const data = await res.json();
      setGroupStudents(data.students || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Reassign
  const handleReassign = async () => {
    if (!activeTeam || !selectedStudentId) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/teams/${activeTeam.id}/assign-leader`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: selectedStudentId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'فشل في تعيين قائد الفريق');

      setGeneratedUrl(data.leader_url);
      toast.success(data.message || 'تم تعيين وتحديث قائد الفريق وتوليد الرابط بنجاح!');
      fetchTeams();
    } catch (err: any) {
      toast.error(err.message || 'فشل في تعيين قائد الفريق');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to extract leader safely whether array or object
  const getLeaderInfo = (t: any) => {
    const leaderObj = Array.isArray(t?.team_leader) ? t.team_leader[0] : t?.team_leader;
    return leaderObj || null;
  };

  // Filtered teams list
  const filteredTeams = teams.filter(t => {
    const leaderObj = getLeaderInfo(t);
    if (search) {
      const leaderName = leaderObj?.student?.full_name?.toLowerCase() || '';
      const teamName = t.name.toLowerCase();
      const s = search.toLowerCase();
      if (!leaderName.includes(s) && !teamName.includes(s)) return false;
    }
    return true;
  });

  const teamsWithLeader = filteredTeams.filter(t => !!getLeaderInfo(t)?.student);
  const teamsWithoutLeader = filteredTeams.filter(t => !getLeaderInfo(t)?.student);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="قادة الفرق"
        subtitle="إدارة روابط دخول قادة الفرق، تعيين قادة جدد، وتوليد روابط الوصول الآمنة"
        breadcrumb={[
          { label: 'الرئيسية', href: '/admin' },
          { label: 'قادة الفرق' },
        ]}
      />

      {/* Filter and stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="sm" className="md:col-span-2">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-3)', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>المجموعة:</label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="form-select"
                style={{ fontSize: '0.8rem', width: 'auto' }}
              >
                <option value="">جميع المجموعات ({groups.length})</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>المجموعة {g.name}</option>
                ))}
              </select>
            </div>

            <div style={{ width: '100%', maxWidth: '280px' }}>
              <input
                type="text"
                placeholder="بحث بالقائد أو الفريق..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-input"
              />
            </div>
          </div>
        </Card>

        <Card padding="sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', textAlign: 'center' }}>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>قادة معينون</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success-solid)' }}>{teamsWithLeader.length}</p>
          </div>
          <div style={{ height: '32px', width: '1px', backgroundColor: 'var(--border-subtle)' }} />
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>فرق بدون قائد</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--warning-solid)' }}>{teamsWithoutLeader.length}</p>
          </div>
        </Card>
      </div>

      {/* Leaders Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-16) 0' }}>
          <div className="inline-block animate-spin" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '4px solid var(--primary-solid)', borderTopColor: 'transparent', margin: '0 auto' }} />
          <p style={{ marginTop: 'var(--spacing-3)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>جاري تحميل بيانات قادة الفرق...</p>
        </div>
      ) : filteredTeams.length === 0 ? (
        <EmptyState
          title="لا توجد بيانات"
          description="لم يتم العثور على فرق تطابق معايير البحث"
        />
      ) : (
        <TableWrapper>
          <thead>
            <tr>
              <Th>الفريق</Th>
              <Th>المجموعة الدراسية</Th>
              <Th>اسم قائد الفريق</Th>
              <Th>حالة رابط الدخول</Th>
              <Th>الإجراءات</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTeams.map((team) => {
              const leaderObj = getLeaderInfo(team);
              const leader = leaderObj?.student;
              const hasLeader = !!leader;
              const isRevoked = leaderObj?.link_revoked_at;

              return (
                <tr key={team.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <Td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                       👥 
                      <span>{team.name}</span>
                    </span>
                  </Td>
                  <Td>
                    <span className="badge badge-primary">
                      المجموعة {team.academic_group?.name}
                    </span>
                  </Td>
                  <Td>
                    {hasLeader ? (
                      <span className="font-semibold text-slate-800 flex items-center gap-1">
                         👑  {leader.full_name}
                      </span>
                    ) : (
                      <span className="text-amber-600 text-xs font-semibold">غير محدد</span>
                    )}
                  </Td>
                  <Td>
                    {!hasLeader ? (
                      <span className="text-xs text-slate-400">لا يوجد رابط</span>
                    ) : isRevoked ? (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
                        ملغي
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">
                        مفعل
                      </span>
                    )}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      {hasLeader ? (
                        <>
                          <button
                            onClick={() => handleRegenerateLink(team)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-medium transition-colors"
                            title="توليد رابط جديد ونسخه"
                          >
                            🔗 توليد ونسخ الرابط
                          </button>
                          <button
                            onClick={() => openReassignModal(team)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition-colors"
                            title="تغيير قائد الفريق"
                          >
                            تغيير القائد
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => openReassignModal(team)}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold transition-colors"
                        >
                          👑 تعيين قائد
                        </button>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrapper>
      )}

      {/* Modal: Reassign Leader */}
      <Modal
        isOpen={reassignModalOpen}
        onClose={() => {
          setReassignModalOpen(false);
          setGeneratedUrl(null);
          setSelectedStudentId('');
        }}
        title={getLeaderInfo(activeTeam)?.student ? `تغيير قائد فريق: ${activeTeam?.name || ''}` : `تعيين قائد لـ: ${activeTeam?.name || ''}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            اختر طالباً من طلاب مجموعة <strong>{activeTeam?.academic_group?.name}</strong>. سيتم تحديث صلاحية قيادة الفريق فورياً وتوليد رابط دخول آمن للقائد الجديد.
          </p>

          <Select
            label="اختر الطالب المرشح للقيادة"
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            options={groupStudents.map(s => ({
              value: s.id,
              label: s.full_name,
            }))}
            placeholder="ابحث واختر الطالب..."
            required
          />

          {generatedUrl && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl space-y-2">
              <p className="text-xs font-bold text-green-800">✅ تم تعيين القائد وتوليد الرابط بنجاح:</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={rebaseAppUrl(generatedUrl)}
                  className="w-full text-xs font-mono bg-white p-2 border border-green-300 rounded-md"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  onClick={async () => {
                    const targetUrl = rebaseAppUrl(generatedUrl);
                    const ok = await copyToClipboard(targetUrl);
                    if (ok) {
                      toast.success('تم نسخ الرابط بنجاح!');
                    } else {
                      toast.error('يرجى نسخ الرابط يدوياً');
                    }
                  }}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-bold whitespace-nowrap"
                >
                  نسخ
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setReassignModalOpen(false);
                setGeneratedUrl(null);
                setSelectedStudentId('');
              }}
            >
              إغلاق
            </Button>
            {!generatedUrl && (
              <Button
                variant="primary"
                onClick={handleReassign}
                disabled={submitting || !selectedStudentId}
              >
                {submitting ? 'جاري التعيين...' : (getLeaderInfo(activeTeam)?.student ? 'تأكيد تغيير القائد' : 'تأكيد تعيين القائد')}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
