'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader, Card, Button, Modal, Badge, EmptyState, TableWrapper, Th, Td, ConfirmDialog, useToast } from '@/components/ui';
import { Input, Select } from '@/components/ui/Input';
import type { AcademicGroup } from '@/types';

interface StudentWithStatus {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  academic_group_id: string;
  academic_group: { id: string; name: string };
  effective_status: string;
  current_team: { id: string; name: string } | null;
  created_at: string;
}

export default function StudentsPage() {
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentWithStatus[]>([]);
  const [groups, setGroups] = useState<AcademicGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<StudentWithStatus | null>(null);
  const [deleteStudent, setDeleteStudent] = useState<StudentWithStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    academic_group_id: '',
    notes: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: '50',
    });
    if (selectedGroup) params.set('group_id', selectedGroup);
    if (search) params.set('search', search);
    if (selectedStatus) params.set('status', selectedStatus);

    const [studentsRes, groupsRes] = await Promise.all([
      fetch(`/api/admin/students?${params}`),
      fetch('/api/admin/groups'),
    ]);

    const studentsData = await studentsRes.json();
    const groupsData = await groupsRes.json();

    setStudents(studentsData.students || []);
    setTotalCount(studentsData.count || 0);
    setGroups(groupsData.groups || []);
    setLoading(false);
  }, [selectedGroup, search, selectedStatus, page]);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setEditStudent(null);
    setForm({ full_name: '', email: '', phone: '', academic_group_id: selectedGroup || '', notes: '' });
    setModalOpen(true);
  };

  const openEdit = (student: StudentWithStatus) => {
    setEditStudent(student);
    setForm({
      full_name: student.full_name,
      email: student.email || '',
      phone: student.phone || '',
      academic_group_id: student.academic_group_id,
      notes: '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.full_name || !form.academic_group_id) {
      toast.error('يرجى إدخال اسم الطالب والمجموعة الدراسية');
      return;
    }
    setSubmitting(true);
    const url = editStudent ? `/api/admin/students/${editStudent.id}` : '/api/admin/students';
    const method = editStudent ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      toast.success(editStudent ? 'تم تعديل بيانات الطالب بنجاح' : 'تم إضافة الطالب بنجاح');
      setModalOpen(false);
      loadData();
    } else {
      const errData = await res.json().catch(() => ({}));
      toast.error(errData.message || 'حدث خطأ، يرجى المحاولة مرة أخرى');
    }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deleteStudent) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/students/${deleteStudent.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('تم حذف الطالب بنجاح');
      loadData();
    } else {
      toast.error('لا يمكن حذف الطالب لأنه منضم إلى فريق');
    }
    setDeleting(false);
    setDeleteStudent(null);
  };

  const statusOptions = [
    { value: '', label: 'جميع الحالات' },
    { value: 'available', label: 'متاح' },
    { value: 'invitation_pending', label: 'في انتظار التأكيد' },
    { value: 'confirmed', label: 'مؤكد' },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="قائمة الطلاب"
        subtitle={`إجمالي الطلاب المسجلين: ${totalCount} طالب`}
        breadcrumb={[
          { label: 'الرئيسية', href: '/admin' },
          { label: 'الطلاب' },
        ]}
        actions={
          <div className="flex gap-2">
            <Link href="/admin/import">
              <Button variant="outline">
                استيراد من Excel
              </Button>
            </Link>
            <Button onClick={openCreate}>
              إضافة طالب جديد
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            placeholder="بحث باسم الطالب..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
          />
          <Select
            options={[{ value: '', label: 'جميع المجموعات' }, ...groups.map(g => ({ value: g.id, label: `المجموعة ${g.name}` }))]}
            value={selectedGroup}
            onChange={(e) => { setSelectedGroup(e.target.value); setPage(1); }}
            placeholder="جميع المجموعات"
          />
          <Select
            options={statusOptions}
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
            placeholder="جميع الحالات"
          />
        </div>
      </Card>

      {/* Students Table */}
      <Card padding="none">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-slate-400">جاري التحميل...</p>
          </div>
        ) : students.length === 0 ? (
          <EmptyState
            icon="👨‍🎓"
            title="لا يوجد طلاب"
            description={search || selectedGroup ? 'لم يتم العثور على طلاب بالمعايير المحددة' : 'ابدأ بإضافة الطلاب أو استيرادهم من ملف Excel'}
            action={<Button onClick={openCreate}>إضافة طالب</Button>}
          />
        ) : (
          <TableWrapper>
            <thead>
              <tr>
                <Th>الاسم</Th>
                <Th>المجموعة</Th>
                <Th>الحالة</Th>
                <Th>الفريق الحالي</Th>
                <Th>الإجراءات</Th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                  <Td>
                    <div className="font-medium text-slate-800">{student.full_name}</div>
                    {student.email && <div className="text-xs text-slate-400">{student.email}</div>}
                  </Td>
                  <Td>
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-semibold">
                      {student.academic_group?.name}
                    </span>
                  </Td>
                  <Td>
                    <Badge status={student.effective_status} type="membership" />
                  </Td>
                  <Td>
                    {student.current_team ? (
                      <span className="text-sm text-slate-700">{student.current_team.name}</span>
                    ) : (
                      <span className="text-slate-300 text-sm">—</span>
                    )}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEdit(student)}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => setDeleteStudent(student)}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                      >
                        حذف
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        )}

        {/* Pagination */}
        {totalCount > 50 && (
          <div className="p-4 flex items-center justify-between border-t border-slate-100">
            <p className="text-sm text-slate-500">
              عرض {Math.min(50, students.length)} من {totalCount} طالب
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                السابق
              </Button>
              <Button variant="secondary" size="sm" disabled={page * 50 >= totalCount} onClick={() => setPage(p => p + 1)}>
                التالي
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editStudent ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>إلغاء</Button>
            <Button onClick={handleSubmit} loading={submitting}>
              {editStudent ? 'حفظ التعديلات' : 'إضافة الطالب'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="الاسم الكامل"
            required
            value={form.full_name}
            onChange={e => setForm({ ...form, full_name: e.target.value })}
          />
          <Select
            label="المجموعة الدراسية"
            required
            options={groups.map(g => ({ value: g.id, label: g.name }))}
            value={form.academic_group_id}
            onChange={e => setForm({ ...form, academic_group_id: e.target.value })}
            placeholder="اختر المجموعة"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="البريد الإلكتروني"
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label="رقم الهاتف"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteStudent}
        onClose={() => setDeleteStudent(null)}
        onConfirm={handleDelete}
        title="حذف الطالب"
        message={`هل أنت متأكد من حذف الطالب "${deleteStudent?.full_name}"؟`}
        confirmLabel="حذف"
        loading={deleting}
      />
    </div>
  );
}
