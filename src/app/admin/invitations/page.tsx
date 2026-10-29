'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  PageHeader, Card, Button, Modal, Badge, EmptyState,
  TableWrapper, Th, Td, ConfirmDialog, useToast
} from '@/components/ui';
import { Select } from '@/components/ui/Input';
import { buildInvitationUrl, formatDate, rebaseAppUrl, copyToClipboard } from '@/lib/utils';
import type { TeamWithDetails, Student } from '@/types';

export default function InvitationsPage() {
  const { toast } = useToast();
  const [invitations, setInvitations] = useState<any[]>([]);
  const [teams, setTeams] = useState<TeamWithDetails[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [loading, setLoading] = useState(true);

  // Create invite modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [inviteStudentId, setInviteStudentId] = useState('');
  const [inviteTeamId, setInviteTeamId] = useState('');
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Revoke state
  const [activeInvite, setActiveInvite] = useState<any | null>(null);
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);

  // Fetch teams & students
  useEffect(() => {
    fetch('/api/admin/teams')
      .then(res => res.json())
      .then(data => setTeams(data.teams || []))
      .catch(console.error);

    fetch('/api/admin/students?page_size=300')
      .then(res => res.json())
      .then(data => setStudents(data.students || []))
      .catch(console.error);
  }, []);

  // Fetch invitations
  const fetchInvitations = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/admin/invitations?';
      if (selectedStatus) url += `status=${selectedStatus}&`;
      if (selectedTeam) url += `team_id=${selectedTeam}&`;

      const res = await fetch(url);
      const data = await res.json();
      setInvitations(data.invitations || []);
    } catch (err) {
      console.error(err);
      toast.error('فشل في تحميل الدعوات');
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, selectedTeam, toast]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  // Create new invitation
  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteStudentId || !inviteTeamId) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: inviteStudentId, team_id: inviteTeamId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'فشل في إنشاء الدعوة');

      setCreatedUrl(data.invitation_url);
      toast.success('تم إنشاء رابط الدعوة بنجاح!');
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء إنشاء الدعوة');
    } finally {
      setSubmitting(false);
    }
  };

  // Revoke invitation
  const handleRevokeInvite = async () => {
    if (!activeInvite) return;

    try {
      const res = await fetch(`/api/admin/invitations/${activeInvite.id}/revoke`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'فشل في إلغاء الدعوة');

      toast.success('تم إلغاء الدعوة بنجاح');
      setRevokeConfirmOpen(false);
      setActiveInvite(null);
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء إلغاء الدعوة');
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="إدارة الدعوات"
        subtitle="متابعة وإلغاء وتوليد روابط دعوة الطلاب للانضمام إلى الفرق"
        breadcrumb={[
          { label: 'الرئيسية', href: '/admin' },
          { label: 'الدعوات' },
        ]}
        actions={
          <Button variant="primary" onClick={() => {
            setCreatedUrl(null);
            setCreateModalOpen(true);
          }}>
            <span>✉️</span> إنشاء دعوة جديدة
          </Button>
        }
      />

      {/* Filters */}
      <Card padding="sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Select
            label="تصفية حسب الحالة"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            options={[
              { value: '', label: 'جميع الحالات' },
              { value: 'pending', label: 'معلقة (بانتظار التأكيد)' },
              { value: 'confirmed', label: 'مؤكدة' },
              { value: 'revoked', label: 'ملغاة' },
              { value: 'expired', label: 'منتهية الصلاحية' },
            ]}
          />

          <Select
            label="تصفية حسب الفريق"
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            options={[
              { value: '', label: 'جميع الفرق' },
              ...teams.map(t => ({
                value: t.id,
                label: t.name.includes('المجموعة') ? t.name : `${t.name} — المجموعة ${t.academic_group?.name || ''}`,
              })),
            ]}
          />
        </div>
      </Card>

      {/* Invitations Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-16) 0' }}>
          <div className="inline-block animate-spin" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '4px solid var(--primary-solid)', borderTopColor: 'transparent', margin: '0 auto' }} />
          <p style={{ marginTop: 'var(--spacing-3)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>جاري تحميل الدعوات...</p>
        </div>
      ) : invitations.length === 0 ? (
        <EmptyState
          title="لا توجد دعوات"
          description="لم يتم العثور على أي دعوات مرسلة تطابق معايير التصفية المحددة"
          action={
            <Button variant="primary" onClick={() => {
              setCreatedUrl(null);
              setCreateModalOpen(true);
            }}>
              إنشاء أول دعوة
            </Button>
          }
        />
      ) : (
        <TableWrapper>
          <thead>
            <tr>
              <Th>اسم الطالب</Th>
              <Th>الفريق المستهدف</Th>
              <Th>المجموعة</Th>
              <Th>تاريخ الإنشاء</Th>
              <Th>الحالة</Th>
              <Th>الإجراءات</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invitations.map((invite) => (
              <tr key={invite.id} className="hover:bg-slate-50/70 transition-colors">
                <Td className="font-bold text-slate-900">{invite.student?.full_name}</Td>
                <Td>
                  <span className="font-semibold text-slate-800">🐇 {invite.team?.name}</span>
                </Td>
                <Td>
                  <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">
                    {invite.team?.academic_group?.name || invite.student?.academic_group?.name}
                  </span>
                </Td>
                <Td className="text-xs text-slate-500">{formatDate(invite.created_at)}</Td>
                <Td>
                  <Badge status={invite.status} type="invitation" />
                </Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    {invite.status === 'pending' && (
                      <button
                        onClick={() => {
                          setActiveInvite(invite);
                          setRevokeConfirmOpen(true);
                        }}
                        className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded text-xs font-semibold transition-colors"
                      >
                        إلغاء الدعوة
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrapper>
      )}

      {/* Modal: Create Invitation */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="إنشاء رابط دعوة لطالب"
      >
        <form onSubmit={handleCreateInvite} className="space-y-4">
          <p className="text-xs text-slate-500">
            اختر الطالب والفريق المراد دعوته إليه. سيتم إنشاء رابط تأكيد فوري يرسل إلى الطالب.
          </p>

          <Select
            label="اختر الفريق"
            value={inviteTeamId}
            onChange={(e) => setInviteTeamId(e.target.value)}
            options={teams.map(t => ({
              value: t.id,
              label: t.name.includes('المجموعة') ? t.name : `${t.name} — المجموعة ${t.academic_group?.name || ''}`,
            }))}
            placeholder="اختر الفريق..."
            required
          />

          <Select
            label="اختر الطالب"
            value={inviteStudentId}
            onChange={(e) => setInviteStudentId(e.target.value)}
            options={students.map(s => ({
              value: s.id,
              label: s.full_name,
            }))}
            placeholder="ابحث واختر الطالب..."
            required
          />

          {createdUrl && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl space-y-2">
              <p className="text-xs font-bold text-green-800">✅ تم إنشاء رابط الدعوة بنجاح:</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={rebaseAppUrl(createdUrl)}
                  className="w-full text-xs font-mono bg-white p-2 border border-green-300 rounded-md"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const fullUrl = rebaseAppUrl(createdUrl);
                    const ok = await copyToClipboard(fullUrl);
                    if (ok) {
                      toast.success('تم نسخ الرابط بنجاح!');
                    } else {
                      toast.error('تعذر نسخ الرابط تلقائياً، يرجى تحديده ونسخه يدوياً');
                    }
                  }}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-bold whitespace-nowrap"
                >
                  نسخ
                </button>
              </div>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`مرحباً! هذا هو رابط دعوتك للانضمام إلى الفريق المختبري:\n${rebaseAppUrl(createdUrl)}`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-green-700 font-bold hover:underline"
              >
                <span>💬</span> مشاركة عبر واتساب مباشرة
              </a>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
              إلغاء
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              توليد رابط الدعوة
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Dialog: Revoke */}
      <ConfirmDialog
        isOpen={revokeConfirmOpen}
        onClose={() => setRevokeConfirmOpen(false)}
        onConfirm={handleRevokeInvite}
        title="إلغاء الدعوة"
        message={`هل أنت متأكد من رغبتك في إلغاء رابط دعوة الطالب "${activeInvite?.student?.full_name}"؟ لن يتمكن من الانضمام بهذا الرابط مجدداً.`}
        confirmLabel="نعم، قم بإلغاء الدعوة"
        variant="danger"
      />
    </div>
  );
}
