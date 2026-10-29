'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  PageHeader, Card, Button, EmptyState, Badge, CapacityBar, Modal, useToast
} from '@/components/ui';
import { Select, Input } from '@/components/ui/Input';
import { getCleanTeamName } from '@/lib/utils';
import type { AcademicGroup } from '@/types';

export default function AssignmentsPage() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<AcademicGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [teams, setTeams] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchStudent, setSearchStudent] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Move member modal state
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [sourceTeamId, setSourceTeamId] = useState<string>('');
  const [destinationTeamId, setDestinationTeamId] = useState<string>('');

  // Capacity edit state
  const [capacityModalOpen, setCapacityModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any | null>(null);
  const [newCapacity, setNewCapacity] = useState<number>(6);

  // Fetch groups
  useEffect(() => {
    fetch('/api/admin/groups')
      .then(res => res.json())
      .then(data => {
        setGroups(data.groups || []);
        if (data.groups?.length > 0) {
          setSelectedGroup(data.groups[0].id);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch teams and students for selected group
  const fetchData = useCallback(async () => {
    if (!selectedGroup) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/assignments?group_id=${selectedGroup}`);
      const data = await res.json();

      setTeams(data.teams || []);
      setStudents(data.unassigned || []);
    } catch (err) {
      console.error(err);
      toast('فشل في تحميل بيانات المجموعة', { type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedGroup]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Unassigned students filtered
  const filteredUnassigned = students.filter(s => {
    if (!searchStudent) return true;
    const name = s.full_name.toLowerCase();
    const id = (s.student_id || '').toLowerCase();
    const query = searchStudent.toLowerCase();
    return name.includes(query) || id.includes(query);
  });

  // Assign student directly to team
  const handleAssignStudent = async (studentId: string, teamId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', student_id: studentId, team_id: teamId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error === 'team_at_capacity' ? 'الفريق مكتمل السعة' : data.error || 'فشل في إضافة الطالب');

      toast('تم إلحاق الطالب بالفريق بنجاح', { type: 'success' });
      fetchData();
    } catch (err: any) {
      toast(err.message, { type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Remove membership
  const handleRemoveMembership = async (membershipId: string, studentName: string) => {
    if (!confirm(`هل أنت متأكد من رغبتك في إزالة الطالب "${studentName}" من الفريق؟ سيصبح الطالب متاحاً للانضمام لفريق آخر.`)) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', membership_id: membershipId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل في إزالة الطالب');

      toast('تمت إزالة الطالب من الفريق بنجاح وأصبح متاحاً', { type: 'success' });
      fetchData();
    } catch (err: any) {
      toast(err.message, { type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Open move modal
  const openMoveModal = (member: any, teamId: string) => {
    setSelectedMember(member);
    setSourceTeamId(teamId);
    setDestinationTeamId('');
    setMoveModalOpen(true);
  };

  // Execute move
  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !destinationTeamId) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move',
          student_id: selectedMember.student?.id,
          from_team_id: sourceTeamId,
          to_team_id: destinationTeamId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error === 'destination_team_at_capacity' ? 'الفريق المنقول إليه مكتمل السعة' : data.error || 'فشل في نقل الطالب');

      toast(`تم نقل الطالب "${selectedMember.student?.full_name}" بنجاح!`, { type: 'success' });
      setMoveModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast(err.message, { type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Open capacity modal
  const openCapacityModal = (team: any) => {
    setEditingTeam(team);
    setNewCapacity(team.max_capacity || 6);
    setCapacityModalOpen(true);
  };

  // Save capacity
  const handleSaveCapacity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_capacity',
          team_id: editingTeam.id,
          capacity: newCapacity,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل في تحديث سعة الفريق');

      toast(`تم تعديل سعة "${editingTeam.name}" إلى ${newCapacity} طلاب!`, { type: 'success' });
      setCapacityModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast(err.message, { type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="إدارة التوزيع وتسكين الطلاب"
        subtitle="لوحة تحكم تفاعلية لتوزيع الطلاب غير الموزعين، نقل الطلاب بين الفرق، وإدارة سعة الفرق بسهولة"
        breadcrumb={[
          { label: 'الرئيسية', href: '/admin' },
          { label: 'إدارة التوزيع' },
        ]}
      />

      {/* Group selector */}
      <Card padding="sm">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>المجموعة الدراسية:</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="form-select"
              style={{ width: 'auto', minWidth: '220px' }}
            >
              {groups.map(g => (
                <option key={g.id} value={g.id}>المجموعة {g.name}</option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)' }}>
            <span>عدد الفرق: <strong style={{ color: 'var(--text-main)' }}>{teams.length}</strong></span>
            <span>الطلاب غير الموزعين: <strong style={{ color: 'var(--warning-solid)' }}>{students.length}</strong></span>
          </div>
        </div>
      </Card>

      {/* Main Two-Column Workstation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Unassigned Students Drawer (4 cols) */}
        <div className="lg:col-span-4 col-span-12 space-y-4" style={{ minWidth: '280px' }}>
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <span>👨‍🎓</span>
                <span>الطلاب غير الموزعين</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                  {filteredUnassigned.length}
                </span>
              </h3>
            </div>

            <div className="mb-3">
              <input
                type="text"
                placeholder="🔍 بحث باسم الطالب..."
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto divide-y divide-slate-100">
              {loading ? (
                <p className="text-center py-6 text-xs text-slate-400">جاري التحميل...</p>
              ) : filteredUnassigned.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  <span className="text-2xl block mb-1">🎉</span>
                  {searchStudent ? 'لا يوجد طلاب يطابقون البحث' : 'جميع طلاب هذه المجموعة تم تسكينهم في الفرق!'}
                </div>
              ) : (
                filteredUnassigned.map((s) => (
                  <div key={s.id} className="pt-2.5 first:pt-0 pb-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{s.full_name}</p>
                      </div>
                    </div>
                    {/* Quick Assign Dropdown */}
                    <div className="flex items-center gap-1.5">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAssignStudent(s.id, e.target.value);
                            e.target.value = '';
                          }
                        }}
                        defaultValue=""
                        disabled={actionLoading}
                        className="form-select"
                        style={{ fontSize: '0.75rem', padding: 'var(--spacing-1) var(--spacing-2)' }}
                      >
                        <option value="" disabled>إلحاق مباشر بفريق...</option>
                        {teams.map(t => {
                          const confirmed = (t.memberships || []).filter((m: any) => m.status === 'confirmed').length;
                          const available = t.max_capacity - confirmed;
                          const teamLabel = t.name.includes('المجموعة') ? t.name : `${t.name} — المجموعة ${groups.find(g => g.id === selectedGroup)?.name || ''}`;
                          return (
                            <option key={t.id} value={t.id} disabled={available <= 0}>
                              {teamLabel} ({available > 0 ? `${available} أماكن شاغرة` : 'مكتمل'})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Teams Grid (8 cols) */}
        <div className="lg:col-span-8 col-span-12 space-y-4">
          <div className="flex justify-between items-center mb-1">
            <h3 className="font-bold text-slate-800 text-sm">فرق المجموعة ({teams.length} فريق)</h3>
            <span className="text-xs text-slate-500">
              إجمالي الأماكن الشاغرة:{' '}
              <strong className="text-blue-700">
                {teams.reduce((acc, t) => {
                  const conf = (t.memberships || []).filter((m: any) => m.status === 'confirmed').length;
                  return acc + Math.max(0, t.max_capacity - conf);
                }, 0)}
              </strong> مقعد
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.map((team) => {
              const confirmedMembers = (team.memberships || []).filter((m: any) => m.status === 'confirmed');
              const pendingMembers = (team.memberships || []).filter((m: any) => m.status === 'invitation_pending');
              const confirmedCount = confirmedMembers.length;
              const isFull = confirmedCount >= team.max_capacity;

              return (
                <Card key={team.id} padding="sm" className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <span>👥</span>
                        <span>{getCleanTeamName(team.name, groups.find(g => g.id === selectedGroup)?.name)}</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {team.team_leader?.student ? `القائد: ${team.team_leader.student.full_name}` : 'بدون قائد'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openCapacityModal(team)}
                        className="text-[11px] text-slate-400 hover:text-blue-600 transition-colors p-1"
                        title="تعديل سعة الفريق"
                      >
                        ⚙️
                      </button>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        isFull ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {confirmedCount}/{team.max_capacity}
                      </span>
                    </div>
                  </div>

                  <CapacityBar confirmed={confirmedCount} max={team.max_capacity} pending={pendingMembers.length} />

                  {/* Members list */}
                  <div className="border border-slate-100 rounded-lg p-2 bg-slate-50/50 space-y-1.5 min-h-[110px] max-h-52 overflow-y-auto">
                    {confirmedMembers.length === 0 && pendingMembers.length === 0 ? (
                      <p className="text-center py-6 text-[11px] text-slate-400">لا يوجد أعضاء بالفريق بعد</p>
                    ) : (
                      <>
                        {confirmedMembers.map((m: any) => (
                          <div key={m.id} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs shadow-xs">
                            <span className="font-medium text-slate-800 flex items-center gap-1 truncate max-w-[140px]">
                              {m.is_leader && <span title="قائد الفريق">👑</span>}
                              {m.student?.full_name}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openMoveModal(m, team.id)}
                                disabled={actionLoading}
                                className="text-[10px] text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors"
                                title="نقل إلى فريق آخر"
                              >
                                نقل
                              </button>
                              <button
                                onClick={() => handleRemoveMembership(m.id, m.student?.full_name)}
                                disabled={actionLoading}
                                className="text-[10px] text-red-500 hover:bg-red-50 px-1.5 py-0.5 rounded transition-colors"
                                title="إزالة من الفريق"
                              >
                                إزالة
                              </button>
                            </div>
                          </div>
                        ))}
                        {pendingMembers.map((m: any) => (
                          <div key={m.id} className="flex items-center justify-between bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200 text-xs">
                            <span className="text-amber-900 truncate max-w-[140px]">
                              {m.student?.full_name}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-amber-700 font-bold">معلق</span>
                              <button
                                onClick={() => handleRemoveMembership(m.id, m.student?.full_name)}
                                disabled={actionLoading}
                                className="text-[10px] text-red-600 hover:bg-red-100 px-1 py-0.5 rounded"
                                title="إلغاء الدعوة"
                              >
                                إلغاء
                              </button>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Move Member Modal */}
      <Modal
        isOpen={moveModalOpen}
        onClose={() => setMoveModalOpen(false)}
        title="نقل الطالب إلى فريق آخر"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setMoveModalOpen(false)}>إلغاء</Button>
            <Button onClick={handleMoveSubmit} loading={actionLoading} disabled={!destinationTeamId}>
              تأكيد النقل
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs">
            <p className="font-bold text-blue-900">الطالب المراد نقله:</p>
            <p className="text-sm font-semibold text-blue-950 mt-1">{selectedMember?.student?.full_name}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-main)' }}>
              اختر الفريق الوجهة (ضمن نفس المجموعة الدراسية):
            </label>
            <select
              value={destinationTeamId}
              onChange={(e) => setDestinationTeamId(e.target.value)}
              className="form-select"
              required
            >
              <option value="" disabled>اختر الفريق...</option>
              {teams
                .filter(t => t.id !== sourceTeamId)
                .map(t => {
                  const conf = (t.memberships || []).filter((m: any) => m.status === 'confirmed').length;
                  const avail = t.max_capacity - conf;
                  const label = t.name.includes('المجموعة') ? t.name : `${t.name} — المجموعة ${groups.find(g => g.id === selectedGroup)?.name || ''}`;
                  return (
                    <option key={t.id} value={t.id} disabled={avail <= 0}>
                      {label} ({avail > 0 ? `${avail} أماكن شاغرة` : 'مكتمل'})
                    </option>
                  );
                })}
            </select>
          </div>
        </div>
      </Modal>

      {/* Capacity Edit Modal */}
      <Modal
        isOpen={capacityModalOpen}
        onClose={() => setCapacityModalOpen(false)}
        title={`تعديل سعة الفريق: ${editingTeam?.name}`}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCapacityModalOpen(false)}>إلغاء</Button>
            <Button onClick={handleSaveCapacity} loading={actionLoading}>
              حفظ السعة
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            حدد الحد الأقصى لعدد الطلاب المسموح بانضمامهم لهذا الفريق في تجارب الأرانب.
          </p>
          <Input
            label="السعة القصوى للفريق (عدد الطلاب)"
            type="number"
            min={1}
            max={20}
            value={newCapacity}
            onChange={(e) => setNewCapacity(parseInt(e.target.value) || 1)}
            required
          />
        </div>
      </Modal>
    </div>
  );
}
