'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  PageHeader, Card, Button, Modal, Badge, EmptyState,
  TableWrapper, Th, Td, ConfirmDialog, StatsCard, useToast
} from '@/components/ui';
import { Input } from '@/components/ui/Input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createGroupSchema } from '@/lib/validations';
import type { z } from 'zod';
import type { AcademicGroup } from '@/types';

type GroupForm = z.infer<typeof createGroupSchema>;

interface GroupWithStats extends AcademicGroup {
  total_students: number;
  confirmed_students: number;
  pending_students: number;
  unassigned_students: number;
  teams: { id: string; name: string }[];
}

export default function GroupsPage() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<GroupWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<GroupWithStats | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<GroupWithStats | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<GroupForm>({
    resolver: zodResolver(createGroupSchema) as any,
    defaultValues: { max_students: 40 },
  });

  const loadGroups = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/groups');
      const data = await res.json();
      setGroups(data.groups || []);
    } catch (err) {
      console.error(err);
      toast('تعذر تحميل المجموعات الدراسية', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const openCreate = () => {
    setEditGroup(null);
    reset({ name: '', description: '', max_students: 40 });
    setModalOpen(true);
  };

  const openEdit = (group: GroupWithStats) => {
    setEditGroup(group);
    reset({ name: group.name, description: group.description || '', max_students: group.max_students });
    setModalOpen(true);
  };

  const onSubmit = async (data: GroupForm) => {
    setSubmitting(true);
    const url = editGroup ? `/api/admin/groups/${editGroup.id}` : '/api/admin/groups';
    const method = editGroup ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        toast(
          editGroup ? `تم تعديل المجموعة (${data.name}) وسعتها المستقلة بنجاح` : `تم إنشاء المجموعة (${data.name}) بسعة ${data.max_students} طالب بنجاح`,
          { type: 'success' }
        );
        setModalOpen(false);
        loadGroups();
      } else {
        const err = await res.json();
        toast(
          err.error === 'duplicate' ? 'اسم المجموعة الدراسية موجود مسبقاً' : (err.message || 'حدث خطأ أثناء حفظ المجموعة'),
          { type: 'error' }
        );
      }
    } catch (err: any) {
      toast(err.message || 'فشل الاتصال بالخادم', { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteGroup) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/groups/${deleteGroup.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast(`تم حذف المجموعة (${deleteGroup.name}) بنجاح`, { type: 'success' });
        loadGroups();
      } else {
        const err = await res.json();
        if (err.error === 'cannot_delete_group_with_students') {
          toast(`لا يمكن حذف المجموعة لأنها تحتوي على ${err.count} طالب. يرجى نقلهم أولاً.`, { type: 'error' });
        } else {
          toast('حدث خطأ أثناء حذف المجموعة', { type: 'error' });
        }
      }
    } catch (err: any) {
      toast(err.message || 'فشل الاتصال بالخادم', { type: 'error' });
    } finally {
      setDeleting(false);
      setDeleteGroup(null);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
      <PageHeader
        title="إدارة المجموعات"
        subtitle="إنشاء وإدارة المجموعات الدراسية، التحكم في السعات المستقلة، ومتابعة توزيع الطلاب والفرق"
        breadcrumb={[
          { label: 'الرئيسية', href: '/admin' },
          { label: 'إدارة المجموعات' },
        ]}
        actions={
          <Button onClick={openCreate} variant="primary">
            <span>➕</span> إضافة مجموعة
          </Button>
        }
      />

      {/* Distinction Callout */}
      <div
        style={{
          padding: 'var(--spacing-4)',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-3)',
        }}
      >
        <span style={{ fontSize: '1.5rem' }}>ℹ️</span>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-main)', lineHeight: '1.6' }}>
          <strong>تنبيه السعة المستقلة:</strong> سعة كل مجموعة دراسية (مثل A1: 40، B1: 42، C1: 35) مستقلة تماماً عن المجموعات الأخرى ومستقلة عن سعات الفرق الداخلية. يمكنك إضافة أي عدد من المجموعات الدراسية وضبط سعة كل منها بشكل فردي.
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)' }}>
        <StatsCard
          title="عدد المجموعات النشطة"
          value={groups.length}
          icon={<span>🎓</span>}
          color="indigo"
        />
        <StatsCard
          title="إجمالي عدد الطلبة"
          value={groups.reduce((s, g) => s + (g.total_students || 0), 0)}
          icon={<span>👨‍🎓</span>}
          color="blue"
        />
        <StatsCard
          title="الطلبة المؤكدون بالفرق"
          value={groups.reduce((s, g) => s + (g.confirmed_students || 0), 0)}
          icon={<span>✅</span>}
          color="green"
        />
        <StatsCard
          title="طلبة غير موزعين"
          value={groups.reduce((s, g) => s + (g.unassigned_students || 0), 0)}
          icon={<span>⏳</span>}
          color="red"
        />
      </div>

      {/* Groups Table */}
      <Card padding="none">
        {loading ? (
          <div style={{ padding: 'var(--spacing-16)', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="inline-block animate-spin" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '4px solid var(--primary-solid)', borderTopColor: 'transparent', margin: '0 auto var(--spacing-3)' }} />
            <p>جاري تحميل المجموعات الدراسية وبيانات السعة...</p>
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            title="لا توجد مجموعات دراسية بعد"
            description="يمكنك البدء بإنشاء المجموعات الدراسية وتحديد سعة كل مجموعة بشكل مستقل لتنظيم وتوزيع طلاب المختبر"
            actionLabel="إضافة أول مجموعة الآن"
            onAction={openCreate}
          />
        ) : (
          <TableWrapper>
            <thead>
              <tr>
                <Th>المجموعة الدراسية</Th>
                <Th>سعة المجموعة</Th>
                <Th>عدد الطلبة المسجلين</Th>
                <Th>السعة المتبقية</Th>
                <Th>الطلبة غير الموزعين</Th>
                <Th>عدد الفرق التابعة</Th>
                <Th>الإجراءات</Th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const remaining = Math.max(0, group.max_students - (group.total_students || 0));
                const teamsCount = (group.teams as { id: string }[])?.length || 0;

                return (
                  <tr key={group.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <Td>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                        المجموعة {group.name}
                      </div>
                      {group.description && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {group.description}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
                        {group.max_students} طالب
                      </span>
                    </Td>
                    <Td>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                        {group.total_students || 0} طالب
                      </span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {group.confirmed_students || 0} مؤكد / {group.pending_students || 0} معلق
                      </div>
                    </Td>
                    <Td>
                      <span className={`badge ${remaining > 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontWeight: 700 }}>
                        {remaining} مقعد شاغر
                      </span>
                    </Td>
                    <Td>
                      <span style={{ fontWeight: 700, color: group.unassigned_students > 0 ? 'var(--danger-solid)' : 'var(--text-muted)' }}>
                        {group.unassigned_students || 0}
                      </span>
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--primary-solid)' }}>
                          {teamsCount} فرق
                        </span>
                        <Link
                          href={`/admin/teams?group_id=${group.id}`}
                          className="badge badge-primary"
                          style={{ textDecoration: 'none', fontSize: '0.75rem' }}
                        >
                          عرض الفرق ↗
                        </Link>
                      </div>
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(group)}
                        >
                          ✏️ تعديل
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setDeleteGroup(group)}
                          title="حذف المجموعة"
                        >
                          🗑️
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrapper>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editGroup ? `تعديل المجموعة: ${editGroup.name}` : 'إضافة مجموعة دراسية جديدة'}
        footer={
          <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', width: '100%' }}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>إلغاء</Button>
            <Button variant="primary" onClick={handleSubmit(onSubmit)} disabled={submitting}>
              {submitting ? 'جاري الحفظ...' : (editGroup ? 'حفظ التعديلات' : 'تأكيد إنشاء المجموعة')}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          <Input
            label="اسم المجموعة الدراسية"
            placeholder="مثال: A1 أو B1 أو الشعبة الأولى"
            required
            error={errors.name?.message}
            hint="معرّف المجموعة المميز (لا يمكن تكراره)"
            {...register('name')}
          />
          <Input
            label="سعة المجموعة (الحد الأقصى للطلبة)"
            type="number"
            min={1}
            max={500}
            required
            error={errors.max_students?.message}
            hint="العدد الأقصى المستقل للطلبة المسموح بتسجيلهم في هذه المجموعة"
            {...register('max_students', { valueAsNumber: true })}
          />
          <Input
            label="وصف المجموعة (اختياري)"
            placeholder="مثال: الشعبة الصباحية - القاعة 4..."
            {...register('description')}
          />
        </div>
      </Modal>

      {/* Delete Safe Confirm */}
      <ConfirmDialog
        isOpen={!!deleteGroup}
        title="تأكيد حذف المجموعة الدراسية"
        message={`هل أنت متأكد من حذف المجموعة "${deleteGroup?.name}"؟ لا يمكن حذف المجموعة في حال وجود طلبة مسجلين بها حرصاً على سلامة السجلات الأكاديمية.`}
        confirmLabel="حذف نهائي"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteGroup(null)}
        loading={deleting}
      />
    </div>
  );
}
