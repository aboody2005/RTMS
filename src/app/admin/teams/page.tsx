'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  PageHeader, Card, Button, Modal, Alert, Badge, EmptyState,
  ConfirmDialog, CapacityBar, useToast
} from '@/components/ui';
import { Input, Select } from '@/components/ui/Input';
import { getCleanTeamName } from '@/lib/utils';
import type { Team, AcademicGroup, Student } from '@/types';

export default function TeamsPage() {
  const { toast } = useToast();
  const [teams, setTeams] = useState<any[]>([]);
  const [groups, setGroups] = useState<AcademicGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [assignLeaderModalOpen, setAssignLeaderModalOpen] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [activeTeam, setActiveTeam] = useState<any | null>(null);

  // Single Team Creation Form state
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCapacity, setNewTeamCapacity] = useState(6);
  const [newTeamGroup, setNewTeamGroup] = useState('');
  const [newTeamRabbitNumber, setNewTeamRabbitNumber] = useState<string>('');
  const [newTeamDescription, setNewTeamDescription] = useState('');

  // Edit Team Form state
  const [editTeamId, setEditTeamId] = useState('');
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamCapacity, setEditTeamCapacity] = useState(6);
  const [editTeamGroup, setEditTeamGroup] = useState('');
  const [editTeamRabbitNumber, setEditTeamRabbitNumber] = useState<string>('');
  const [editTeamDescription, setEditTeamDescription] = useState('');
  const [editWarning, setEditWarning] = useState<string | null>(null);

  // Bulk form state
  const [bulkGroup, setBulkGroup] = useState('');
  const [bulkCount, setBulkCount] = useState(8);
  const [bulkCapacity, setBulkCapacity] = useState(6);
  const [bulkPrefix, setBulkPrefix] = useState('الفريق');

  // Assign leader state
  const [groupStudents, setGroupStudents] = useState<Student[]>([]);
  const [selectedLeaderStudentId, setSelectedLeaderStudentId] = useState('');
  const [generatedLeaderUrl, setGeneratedLeaderUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch groups & settings
  useEffect(() => {
    fetch('/api/admin/groups')
      .then(res => res.json())
      .then(data => {
        setGroups(data.groups || []);
      })
      .catch(console.error);

    fetch('/api/admin/settings')
      .then(res => res.json())
      .then(data => {
        if (data.settings?.default_team_capacity) {
          const cap = Number(data.settings.default_team_capacity);
          setNewTeamCapacity(cap);
          setBulkCapacity(cap);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch teams
  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const url = selectedGroup ? `/api/admin/teams?group_id=${selectedGroup}` : '/api/admin/teams';
      const res = await fetch(url);
      const data = await res.json();
      setTeams(data.teams || []);
    } catch (err) {
      console.error(err);
      toast('فشل في تحميل الفرق', { type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedGroup]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Update auto-generated team name when group changes in create modal
  const handleGroupSelectForNewTeam = (groupId: string) => {
    setNewTeamGroup(groupId);
    const grp = groups.find(g => g.id === groupId);
    if (grp) {
      const existingInGroup = teams.filter(t => t.academic_group_id === groupId).length;
      setNewTeamName(`الفريق ${existingInGroup + 1} — المجموعة ${grp.name}`);
      setNewTeamRabbitNumber(String(existingInGroup + 1));
    }
  };

  // Handle single team creation
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim() || !newTeamGroup) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTeamName.trim(),
          academic_group_id: newTeamGroup,
          max_capacity: Number(newTeamCapacity),
          rabbit_number: newTeamRabbitNumber ? Number(newTeamRabbitNumber) : null,
          description: newTeamDescription.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'فشل في إنشاء الفريق');
      }

      toast('تم إنشاء الفريق وتعيين سعته المستقلة بنجاح', { type: 'success' });
      setCreateModalOpen(false);
      setNewTeamName('');
      setNewTeamDescription('');
      setNewTeamRabbitNumber('');
      fetchTeams();
    } catch (err: any) {
      toast(err.message, { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditTeam = (team: any) => {
    setEditTeamId(team.id);
    setEditTeamName(team.name);
    setEditTeamCapacity(team.max_capacity || 6);
    setEditTeamGroup(team.academic_group_id);
    setEditTeamRabbitNumber(team.rabbit_number !== null && team.rabbit_number !== undefined ? String(team.rabbit_number) : '');
    setEditTeamDescription(team.description || '');
    setEditWarning(null);
    setActiveTeam(team);
    setEditModalOpen(true);
  };

  // Handle Edit Team
  const handleEditTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTeamName.trim() || !editTeamGroup || !editTeamId) return;

    const confirmedCount = (activeTeam?.memberships || []).filter((m: any) => m.status === 'confirmed').length;
    if (Number(editTeamCapacity) < confirmedCount) {
      setEditWarning(`تنبيه هام: لا يمكنك تقليل سعة الفريق إلى ${editTeamCapacity} لأن هناك ${confirmedCount} طلاب مسجلين ومؤكدين بالفعل في الفريق. يجب أولاً إعادة توزيع أو إزالة الطلاب الزائدين.`);
      return;
    }

    setSubmitting(true);
    setEditWarning(null);

    try {
      const res = await fetch(`/api/admin/teams/${editTeamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editTeamName.trim(),
          academic_group_id: editTeamGroup,
          max_capacity: Number(editTeamCapacity),
          rabbit_number: editTeamRabbitNumber ? Number(editTeamRabbitNumber) : null,
          description: editTeamDescription.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'فشل في تعديل بيانات الفريق');
      }

      toast(`تم تحديث بيانات ${editTeamName} بنجاح`, { type: 'success' });
      setEditModalOpen(false);
      setActiveTeam(null);
      fetchTeams();
    } catch (err: any) {
      toast(err.message, { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle bulk team creation
  const handleBulkCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkGroup || bulkCount < 1) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bulk: true,
          academic_group_id: bulkGroup,
          count: Number(bulkCount),
          max_capacity: Number(bulkCapacity),
          name_prefix: bulkPrefix.trim() || 'الفريق',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'فشل في إنشاء الفرق المجمعة');
      }

      toast(`تم إنشاء ${bulkCount} فرق بنجاح تحت المجموعة المختارة بالتسمية الموحدة!`, { type: 'success' });
      setBulkModalOpen(false);
      fetchTeams();
    } catch (err: any) {
      toast(err.message, { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Open Assign Leader modal
  const openAssignLeader = async (team: any) => {
    setActiveTeam(team);
    setSelectedLeaderStudentId('');
    setGeneratedLeaderUrl(null);
    setAssignLeaderModalOpen(true);

    try {
      const res = await fetch(`/api/admin/students?group_id=${team.academic_group_id}&page_size=200`);
      const data = await res.json();
      setGroupStudents(data.students || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Assign Leader
  const handleAssignLeader = async () => {
    if (!activeTeam || !selectedLeaderStudentId) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/teams/${activeTeam.id}/assign-leader`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: selectedLeaderStudentId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل في تعيين قائد الفريق');

      setGeneratedLeaderUrl(data.leader_url);
      toast('تم تعيين قائد الفريق وتوليد رابط الدخول الخاص به بنجاح!', { type: 'success' });
      fetchTeams();
    } catch (err: any) {
      toast(err.message, { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Regenerate Leader Link
  const handleRegenerateLeaderLink = async (teamId: string) => {
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/assign-leader`, {
        method: 'PUT',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل في إعادة توليد الرابط');

      navigator.clipboard.writeText(data.leader_url);
      toast('تم إعادة توليد رابط القائد ونسخه إلى الحافظة!', { type: 'success' });
    } catch (err: any) {
      toast(err.message, { type: 'error' });
    }
  };

  // Open Members Modal
  const openMembersModal = (team: any) => {
    setActiveTeam(team);
    setMembersModalOpen(true);
  };

  // Delete team
  const handleDeleteTeam = async () => {
    if (!activeTeam) return;

    try {
      const res = await fetch(`/api/admin/teams/${activeTeam.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || (data.error === 'team_has_confirmed_members' ? 'لا يمكن حذف فريق يحتوي على طلاب مؤكدين' : 'فشل في حذف الفريق'));

      toast('تم حذف الفريق بنجاح', { type: 'success' });
      setDeleteConfirmOpen(false);
      setActiveTeam(null);
      fetchTeams();
    } catch (err: any) {
      toast(err.message, { type: 'error' });
    }
  };

  // Filtered teams
  const filteredTeams = teams.filter(team => {
    if (search) {
      const term = search.toLowerCase();
      const matchName = (team.name || '').toLowerCase().includes(term);
      const matchGroup = (team.academic_group?.name || '').toLowerCase().includes(term);
      const matchLeader = (team.team_leader?.student?.full_name || '').toLowerCase().includes(term);
      const matchRabbit = team.rabbit_number ? String(team.rabbit_number).includes(term) : false;
      if (!matchName && !matchGroup && !matchLeader && !matchRabbit) return false;
    }
    return true;
  });

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
      <PageHeader
        title="إدارة الفرق"
        subtitle="إنشاء وإدارة فرق مختبر علم الأدوية العملي، تحديد السعة المستقلة، وتعيين القادة"
        breadcrumb={[
          { label: 'الرئيسية', href: '/admin' },
          { label: 'إدارة الفرق' },
        ]}
        actions={
          <div style={{ display: 'flex', gap: 'var(--spacing-3)', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              onClick={() => {
                setBulkGroup(selectedGroup || groups[0]?.id || '');
                setBulkModalOpen(true);
              }}
            >
              <span>⚡</span> إنشاء فرق مجمعة
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const grpId = selectedGroup || groups[0]?.id || '';
                handleGroupSelectForNewTeam(grpId);
                setCreateModalOpen(true);
              }}
            >
              <span>➕</span> إضافة فريق
            </Button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <Card padding="md">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-4)', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', flexWrap: 'wrap', minWidth: '280px' }}>
            <label htmlFor="group-filter" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
              تصفية بالمجموعة الدراسية:
            </label>
            <select
              id="group-filter"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="form-select"
              style={{ width: 'auto', minWidth: '200px' }}
            >
              <option value="">جميع المجموعات الدراسية ({groups.length})</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>المجموعة {g.name}</option>
              ))}
            </select>
          </div>

          <div style={{ width: '100%', maxWidth: '340px' }}>
            <input
              type="text"
              placeholder="بحث باسم الفريق، المجموعة، أو القائد..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
            />
          </div>
        </div>
      </Card>

      {/* Teams Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-16) 0' }}>
          <div className="inline-block animate-spin" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '4px solid var(--primary-solid)', borderTopColor: 'transparent', margin: '0 auto' }} />
          <p style={{ marginTop: 'var(--spacing-3)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>جاري تحميل الفرق وبيانات السعة...</p>
        </div>
      ) : filteredTeams.length === 0 ? (
        <EmptyState
          title="لا توجد فرق دراسية"
          description="لم يتم العثور على أي فرق تطابق معايير البحث أو المجموعة الدراسية المحددة"
          actionLabel="إضافة فريق جديد"
          onAction={() => {
            const grpId = selectedGroup || groups[0]?.id || '';
            handleGroupSelectForNewTeam(grpId);
            setCreateModalOpen(true);
          }}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--spacing-5)' }}>
          {filteredTeams.map((team) => {
            const confirmedMembers = (team.memberships || []).filter((m: any) => m.status === 'confirmed');
            const pendingMembers = (team.memberships || []).filter((m: any) => m.status === 'invitation_pending');
            const confirmedCount = confirmedMembers.length;
            const remainingSlots = Math.max(0, team.max_capacity - confirmedCount);
            const isFull = confirmedCount >= team.max_capacity;
            const leader = team.team_leader?.student;

            return (
              <Card
                key={team.id}
                padding="md"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '100%',
                  gap: 'var(--spacing-4)',
                }}
              >
                <div>
                  {/* Team Header & Badges */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-3)' }}>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                        <span>👥</span>
                        <span>{getCleanTeamName(team.name, team.academic_group?.name)}</span>
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-1.5)', flexWrap: 'wrap' }}>
                        <span className="badge badge-primary" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                          المجموعة {team.academic_group?.name || 'غير محددة'}
                        </span>
                        {team.rabbit_number && (
                          <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                            🔬 أرنب {team.rabbit_number}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`badge ${isFull ? 'badge-danger' : 'badge-success'}`} style={{ whiteSpace: 'nowrap' }}>
                      {isFull ? 'مكتمل' : `${remainingSlots} متاح`}
                    </span>
                  </div>

                  {/* Leader Info */}
                  <div
                    style={{
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--spacing-3)',
                      marginBottom: 'var(--spacing-4)',
                      minHeight: '74px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>قائد الفريق:</span>
                      {leader ? (
                        <span style={{ fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>👑</span> {leader.full_name}
                        </span>
                      ) : (
                        <span style={{ fontWeight: 600, color: 'var(--warning-solid)' }}>غير محدد</span>
                      )}
                    </div>
                    {team.team_leader && !team.team_leader.link_revoked_at ? (
                      <div style={{ marginTop: 'var(--spacing-2)', paddingTop: 'var(--spacing-2)', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>رابط القائد مفعل</span>
                        <button
                          type="button"
                          onClick={() => handleRegenerateLeaderLink(team.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary-solid)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: 0,
                          }}
                          title="إعادة توليد ونسخ الرابط"
                        >
                          توليد ونسخ الرابط 🔗
                        </button>
                      </div>
                    ) : (
                      <div style={{ marginTop: 'var(--spacing-2)', paddingTop: 'var(--spacing-2)', borderTop: '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>لا يوجد رابط نشط</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                      </div>
                    )}
                  </div>

                  {/* Capacity Bar & Independent Capacity Stats */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-main)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>سعة الفريق والأعضاء:</span>
                      <span style={{ fontWeight: 700 }}>{confirmedCount} / {team.max_capacity} طالب</span>
                    </div>

                    <CapacityBar
                      confirmed={confirmedCount}
                      max={team.max_capacity}
                      pending={pendingMembers.length}
                      showLabels={false}
                    />

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <span>المقاعد الشاغرة: <strong style={{ color: remainingSlots > 0 ? 'var(--success-solid)' : 'var(--danger-solid)' }}>{remainingSlots}</strong></span>
                      {pendingMembers.length > 0 && (
                        <span style={{ color: 'var(--warning-solid)', fontWeight: 600 }}>
                          +{pendingMembers.length} في انتظار التأكيد
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Team Card Actions - Perfectly balanced with identical heights and aligned horizontal baseline */}
                <div
                  style={{
                    paddingTop: 'var(--spacing-3)',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-2)',
                  }}
                >
                  {/* Primary Members Button (Full Width) */}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openMembersModal(team)}
                    style={{
                      width: '100%',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 'var(--spacing-2)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                  >
                    <span>👥</span>
                    <span>الأعضاء ({confirmedCount})</span>
                  </Button>

                  {/* Action Toolbar on exact same horizontal baseline */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-2)',
                      width: '100%',
                    }}
                  >
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditTeam(team)}
                      title="تعديل اسم الفريق وسعته المستقلة"
                      style={{
                        flex: 1,
                        height: '34px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        fontSize: '0.8rem',
                        padding: '0 8px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span>✏️</span>
                      <span>تعديل</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openAssignLeader(team)}
                      title="تعيين أو تغيير قائد الفريق"
                      style={{
                        flex: 1,
                        height: '34px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        fontSize: '0.8rem',
                        padding: '0 8px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span>👑</span>
                      <span>القائد</span>
                    </Button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTeam(team);
                        setDeleteConfirmOpen(true);
                      }}
                      style={{
                        width: '34px',
                        height: '34px',
                        minWidth: '34px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--danger-solid)',
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        padding: 0,
                        transition: 'background-color 150ms ease',
                      }}
                      title="حذف الفريق بشكل آمن"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Single Team Creation */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="إضافة فريق جديد"
      >
        <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          <Select
            label="المجموعة الدراسية التابع لها الفريق"
            value={newTeamGroup}
            onChange={(e) => handleGroupSelectForNewTeam(e.target.value)}
            options={groups.map(g => ({ value: g.id, label: `المجموعة ${g.name}` }))}
            placeholder="اختر المجموعة الدراسية"
            hint="يتم ربط الفريق تلقائياً بالمجموعة الدراسية المختارة كعلاقة تبعية مباشرة"
            required
          />

          <Input
            label="اسم الفريق"
            placeholder="مثال: الفريق 1 — المجموعة B1"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            hint="يجب أن يوضح الاسم المجموعة الدراسية التابع لها الفريق لتفادي التكرار"
            required
          />

          <Input
            label="سعة هذا الفريق (حد أقصى مستقل)"
            type="number"
            min={2}
            max={20}
            value={newTeamCapacity}
            onChange={(e) => setNewTeamCapacity(Number(e.target.value))}
            hint="تحدد سعة كل فريق بشكل مستقل ومنفصل تماماً عن سعة المجموعة الدراسية الإجمالية"
            required
          />

          <Input
            label="رقم الأرنب التجريبي (اختياري)"
            type="number"
            min={1}
            max={50}
            value={newTeamRabbitNumber}
            onChange={(e) => setNewTeamRabbitNumber(e.target.value)}
            hint="حقل اختياري لتوثيق رقم الأرنب الخاص بالتجربة المعملية منفصلاً عن هوية الفريق"
          />

          <Input
            label="ملاحظات / وصف الفريق (اختياري)"
            value={newTeamDescription}
            onChange={(e) => setNewTeamDescription(e.target.value)}
            placeholder="مثال: مخصص لطلبة الفترة الصباحية..."
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-2)', paddingTop: 'var(--spacing-3)' }}>
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
              إلغاء
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'جاري الحفظ...' : 'حفظ وإنشاء الفريق'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Team */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`تعديل بيانات: ${activeTeam?.name || ''}`}
      >
        <form onSubmit={handleEditTeam} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          {editWarning && (
            <Alert
              type="warning"
              message={editWarning}
              onClose={() => setEditWarning(null)}
            />
          )}

          <Select
            label="المجموعة الدراسية"
            value={editTeamGroup}
            onChange={(e) => setEditTeamGroup(e.target.value)}
            options={groups.map(g => ({ value: g.id, label: `المجموعة ${g.name}` }))}
            required
          />

          <Input
            label="اسم الفريق"
            value={editTeamName}
            onChange={(e) => setEditTeamName(e.target.value)}
            hint="تسمية الفريق موضحاً بها المجموعة، مثل: الفريق 1 — المجموعة B1"
            required
          />

          <Input
            label="سعة الفريق (الحد الأقصى للأعضاء)"
            type="number"
            min={2}
            max={20}
            value={editTeamCapacity}
            onChange={(e) => setEditTeamCapacity(Number(e.target.value))}
            hint={`الطلاب المؤكدون حالياً في هذا الفريق: ${(activeTeam?.memberships || []).filter((m: any) => m.status === 'confirmed').length} طالب`}
            required
          />

          <Input
            label="رقم الأرنب التجريبي (اختياري)"
            type="number"
            min={1}
            max={50}
            value={editTeamRabbitNumber}
            onChange={(e) => setEditTeamRabbitNumber(e.target.value)}
            hint="رقم تعريفي منفصل للأرنب المستخدم في التجربة"
          />

          <Input
            label="ملاحظات / وصف الفريق"
            value={editTeamDescription}
            onChange={(e) => setNewTeamDescription(e.target.value)}
            placeholder="ملاحظات إضافية..."
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-2)', paddingTop: 'var(--spacing-3)' }}>
            <Button variant="secondary" onClick={() => setEditModalOpen(false)}>
              إلغاء
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'جاري حفظ التعديلات...' : 'تحديث بيانات الفريق'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Bulk Teams Creation */}
      <Modal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title="إنشاء فرق مجمعة لمجموعة دراسية"
      >
        <form onSubmit={handleBulkCreate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            يتيح لك هذا المعالج إنشاء عدة فرق دفعة واحدة للمجموعة المختارة، مع تسمية موحدة ومنظمة تلقائياً (مثل: الفريق 1 — المجموعة B1، الفريق 2 — المجموعة B1...).
          </p>

          <Select
            label="المجموعة الدراسية المستهدفة"
            value={bulkGroup}
            onChange={(e) => setBulkGroup(e.target.value)}
            options={groups.map(g => ({ value: g.id, label: `المجموعة ${g.name}` }))}
            placeholder="اختر المجموعة الدراسية"
            required
          />

          <Input
            label="عدد الفرق المراد إنشاؤها"
            type="number"
            min={1}
            max={30}
            value={bulkCount}
            onChange={(e) => setBulkCount(Number(e.target.value))}
            required
          />

          <Input
            label="بادئة اسم الفريق"
            value={bulkPrefix}
            onChange={(e) => setBulkPrefix(e.target.value)}
            placeholder="مثال: الفريق"
            hint="سيتم إلحاق رقم الفريق واسم المجموعة تلقائياً"
            required
          />

          <Input
            label="سعة كل فريق مستقل"
            type="number"
            min={2}
            max={20}
            value={bulkCapacity}
            onChange={(e) => setBulkCapacity(Number(e.target.value))}
            hint="يمكن تعديل سعة كل فريق لاحقاً بشكل مستقل"
            required
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-2)', paddingTop: 'var(--spacing-3)' }}>
            <Button variant="secondary" onClick={() => setBulkModalOpen(false)}>
              إلغاء
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'جاري الإنشاء...' : `إنشاء ${bulkCount} فرق الآن`}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Assign Leader */}
      <Modal
        isOpen={assignLeaderModalOpen}
        onClose={() => setAssignLeaderModalOpen(false)}
        title={`تعيين قائد لـ: ${activeTeam?.name || ''}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            اختر طالباً من طلاب <strong>المجموعة {activeTeam?.academic_group?.name}</strong> لتعيينه قائداً لهذا الفريق. سيتم توليد رابط فريد وآمن يمكنه من خلاله دعوة زملائه.
          </p>

          <Select
            label="اختر الطالب المرشح للقيادة"
            value={selectedLeaderStudentId}
            onChange={(e) => setSelectedLeaderStudentId(e.target.value)}
            options={groupStudents.map(s => ({
              value: s.id,
              label: s.full_name,
            }))}
            placeholder="ابحث واختر الطالب..."
            required
          />

          {generatedLeaderUrl && (
            <div
              style={{
                padding: 'var(--spacing-4)',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-2)',
              }}
            >
              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--success-solid)' }}>
                ✅ تم تعيين القائد وتوليد رابط الدخول بنجاح:
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                <input
                  type="text"
                  readOnly
                  value={generatedLeaderUrl}
                  className="form-input"
                  style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}
                />
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedLeaderUrl);
                    toast('تم نسخ رابط القائد إلى الحافظة!', { type: 'success' });
                  }}
                >
                  نسخ
                </Button>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                أرسل هذا الرابط إلى قائد الفريق ليتمكن من إدارة فريقه ودعوة زملائه من نفس المجموعة الدراسية.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-2)', paddingTop: 'var(--spacing-3)' }}>
            <Button variant="secondary" onClick={() => setAssignLeaderModalOpen(false)}>
              إغلاق
            </Button>
            {!generatedLeaderUrl && (
              <Button
                variant="primary"
                onClick={handleAssignLeader}
                disabled={submitting || !selectedLeaderStudentId}
              >
                {submitting ? 'جاري التعيين...' : 'تأكيد تعيين القائد'}
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal: View Team Members */}
      <Modal
        isOpen={membersModalOpen}
        onClose={() => setMembersModalOpen(false)}
        title={`أعضاء ${getCleanTeamName(activeTeam?.name, activeTeam?.academic_group?.name)} — المجموعة ${activeTeam?.academic_group?.name || ''}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', paddingBottom: 'var(--spacing-2)', borderBottom: '1px solid var(--border-subtle)' }}>
            <span>المجموعة الدراسية: <strong>{activeTeam?.academic_group?.name}</strong></span>
            <span>
              السعة: <strong>{(activeTeam?.memberships || []).filter((m: any) => m.status === 'confirmed').length} / {activeTeam?.max_capacity}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)', maxHeight: '320px', overflowY: 'auto' }}>
            {(() => {
              // Hide removed or revoked/cancelled members from current team members list
              const currentActiveMembers = (activeTeam?.memberships || []).filter(
                (m: any) => m.status === 'confirmed' || m.status === 'invitation_pending'
              );

              if (currentActiveMembers.length === 0) {
                return (
                  <p style={{ textAlign: 'center', padding: 'var(--spacing-6) 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    لا يوجد أعضاء حاليون في هذا الفريق
                  </p>
                );
              }

              return currentActiveMembers.map((m: any) => (
                <div
                  key={m.id}
                  style={{
                    padding: 'var(--spacing-3)',
                    backgroundColor: 'var(--bg-app)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-1.5)' }}>
                      {m.is_leader && <span>👑</span>}
                      <span>{m.student?.full_name}</span>
                    </p>
                  </div>
                  <div>
                    <Badge status={m.status} type="membership" />
                  </div>
                </div>
              ));
            })()}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--spacing-3)' }}>
            <Button variant="secondary" onClick={() => setMembersModalOpen(false)}>
              إغلاق
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="تأكيد حذف الفريق"
        message={`هل أنت متأكد من رغبتك في حذف "${activeTeam?.name}" بشكل آمن؟ لن يتم الحذف في حال وجود طلاب مؤكدين حفاظاً على سلامة البيانات.`}
        confirmLabel="حذف الفريق"
        variant="danger"
        onConfirm={handleDeleteTeam}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}
