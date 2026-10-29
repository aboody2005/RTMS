'use client';

import { useState, useEffect } from 'react';
import {
  PageHeader, Card, Button, StatsCard, ConfirmDialog, TableWrapper, Th, Td, useToast
} from '@/components/ui';
import { Select } from '@/components/ui/Input';
import type { AcademicGroup } from '@/types';

export default function DistributionPage() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<AcademicGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [autoConfirm, setAutoConfirm] = useState(true);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [resultData, setResultData] = useState<any | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Group stats
  const [groupStats, setGroupStats] = useState<{
    totalStudents: number;
    confirmedStudents: number;
    unassignedStudents: number;
    totalSlots: number;
    teamsCount: number;
  } | null>(null);

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

  // Fetch stats when group changes
  useEffect(() => {
    if (!selectedGroup) return;

    setPreviewData(null);
    setResultData(null);

    Promise.all([
      fetch(`/api/admin/students?group_id=${selectedGroup}&page_size=300`).then(r => r.json()),
      fetch(`/api/admin/teams?group_id=${selectedGroup}`).then(r => r.json()),
    ]).then(([studentsData, teamsData]) => {
      const allStudents = studentsData.students || [];
      const teams = teamsData.teams || [];

      const confirmedCount = allStudents.filter((s: any) => s.membership?.status === 'confirmed').length;
      const unassignedCount = allStudents.filter((s: any) => !s.membership || s.membership.status === 'available').length;

      let slots = 0;
      for (const t of teams) {
        const confirmedInTeam = (t.memberships || []).filter((m: any) => m.status === 'confirmed').length;
        slots += Math.max(0, t.max_capacity - confirmedInTeam);
      }

      setGroupStats({
        totalStudents: allStudents.length,
        confirmedStudents: confirmedCount,
        unassignedStudents: unassignedCount,
        totalSlots: slots,
        teamsCount: teams.length,
      });
    }).catch(console.error);
  }, [selectedGroup]);

  // Request distribution preview
  const handlePreview = async () => {
    if (!selectedGroup) return;

    setLoading(true);
    setResultData(null);
    try {
      const res = await fetch('/api/admin/distribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_group_id: selectedGroup,
          preview: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل في محاكاة التوزيع');

      setPreviewData(data);
      toast('تم حساب محاكاة التوزيع العشوائي بنجاح', { type: 'success' });
    } catch (err: any) {
      toast(err.message || 'حدث خطأ أثناء المحاكاة', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Execute actual distribution
  const handleExecute = async () => {
    if (!selectedGroup) return;

    setLoading(true);
    try {
      const res = await fetch('/api/admin/distribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_group_id: selectedGroup,
          distribute_all: true,
          auto_confirm: autoConfirm,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل في تنفيذ التوزيع العشوائي');

      setResultData(data);
      setPreviewData(null);
      setConfirmOpen(false);
      toast(`تم توزيع ${data.distributed_count || data.distributed || 0} طالباً عشوائياً بنجاح!`, { type: 'success' });

      // Refresh group stats
      setTimeout(() => {
        const current = selectedGroup;
        setSelectedGroup('');
        setTimeout(() => setSelectedGroup(current), 50);
      }, 500);
    } catch (err: any) {
      toast(err.message || 'فشل في تنفيذ التوزيع العشوائي', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const selectedGroupName = groups.find(g => g.id === selectedGroup)?.name || '';

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="التوزيع العشوائي للطلاب"
        subtitle="توزيع الطلاب غير المنضمين لفرق عشوائياً وبشكل عادل على الفرق المتاحة"
        breadcrumb={[
          { label: 'الرئيسية', href: '/admin' },
          { label: 'التوزيع العشوائي' },
        ]}
      />

      {/* Control Panel */}
      <Card>
        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span>⚙️</span> إعدادات عملية التوزيع
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="space-y-4">
            <Select
              label="المجموعة الدراسية المستهدفة"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              options={groups.map(g => ({ value: g.id, label: `المجموعة ${g.name}` }))}
            />

            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoConfirm}
                  onChange={(e) => setAutoConfirm(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <div>
                  <span className="text-sm font-semibold text-slate-800">
                    تأكيد الانضمام فورياً (موصى به)
                  </span>
                  <p className="text-xs text-slate-500">
                    عند تفعيله، يتم تثبيت الطلاب في الفرق مباشرة دون الحاجة لانتظار تأكيد كل طالب.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'var(--bg-app)',
              padding: '1.25rem',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
              قواعد التوزيع العشوائي:
            </p>
            <ul style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.7' }} className="space-y-1.5 list-disc list-inside">
              <li>يتم استهداف الطلاب غير المنضمين لأي فريق فقط.</li>
              <li>لا يتم تجاوز السعة القصوى المحددة لأي فريق مستقل.</li>
              <li>يتم توزيع الطلاب بشكل متكافئ على الفرق التي بها أماكن شاغرة ضمن المجموعة الدراسية المختارة.</li>
              <li>العملية مسجلة بالكامل في سجل العمليات للأغراض الرقابية.</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t border-slate-200">
          <Button
            variant="secondary"
            onClick={handlePreview}
            disabled={loading || !selectedGroup}
          >
            <span>🔍</span> معاينة التوزيع
          </Button>
          <Button
            variant="primary"
            onClick={() => setConfirmOpen(true)}
            disabled={loading || !selectedGroup || (groupStats?.unassignedStudents === 0)}
          >
            <span>🎲</span> بدء التوزيع العشوائي
          </Button>
        </div>
      </Card>

      {/* Live Group Stats */}
      {groupStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard
            title="إجمالي الطلاب بالمجموعة"
            value={groupStats.totalStudents}
            icon={<span>👨‍🎓</span>}
            color="blue"
          />
          <StatsCard
            title="طلاب مؤكدون بالفرق"
            value={groupStats.confirmedStudents}
            icon={<span>✅</span>}
            color="green"
          />
          <StatsCard
            title="طلاب غير موزعين"
            value={groupStats.unassignedStudents}
            icon={<span>⏳</span>}
            color="yellow"
          />
          <StatsCard
            title="أماكن شاغرة بالفرق"
            value={groupStats.totalSlots}
            icon={<span>🐇</span>}
            color="purple"
          />
        </div>
      )}

      {/* Preview Simulation Results */}
      {previewData && (
        <Card className="border-blue-200 bg-blue-50/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-blue-900 flex items-center gap-2">
                <span>📊</span> نتيجة محاكاة التوزيع ({selectedGroupName})
              </h3>
              <p className="text-xs text-blue-700 mt-0.5">
                يمكن توزيع {previewData.students_to_distribute} طالباً على {previewData.teams_with_slots?.length || 0} فرق.
                {previewData.students_remaining_after > 0 && (
                  <span className="text-red-600 font-bold mr-1">
                    (سيتبقى {previewData.students_remaining_after} طلاب بدون مقاعد لعدم كفاية السعة)
                  </span>
                )}
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => setConfirmOpen(true)}
              disabled={loading}
            >
              تأكيد وتنفيذ هذا التوزيع
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {previewData.teams_with_slots?.map((team: any) => (
              <div key={team.id} className="bg-white p-3 rounded-lg border border-slate-200 text-xs">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>🐇 {team.name}</span>
                  <span className="text-blue-600">{team.available_slots} أماكن شاغرة</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  المشغول حالياً: {team.confirmed} / {team.max_capacity}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-blue-200 pt-3">
            <p className="text-xs font-semibold text-slate-700 mb-2">
              عينة من الطلاب المرشحين للتوزيع ({previewData.unassigned_students?.length || 0} طالب):
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {previewData.unassigned_students?.map((s: any) => (
                <span key={s.id} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] text-slate-700">
                  {s.full_name}
                </span>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Execution Results */}
      {resultData && (
        <Card className="border-green-300 bg-green-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-xl">
              🎉
            </div>
            <div>
              <h3 className="text-base font-bold text-green-900">
                اكتمل التوزيع العشوائي بنجاح!
              </h3>
              <p className="text-xs text-green-700 mt-0.5">
                تم توزيع {resultData.distributed_count || resultData.distributed || 0} طالباً على فرق {selectedGroupName}.
                {resultData.remaining_unassigned > 0 ? (
                  ` متبقي ${resultData.remaining_unassigned} طالباً بدون فريق.`
                ) : (
                  ' تم تسكين جميع الطلاب بالكامل!'
                )}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title="تأكيد التوزيع العشوائي"
        message={`هل أنت متأكد من رغبتك في توزيع الطلاب غير المنضمين في "${selectedGroupName}" عشوائياً؟ سيتم توزيع الطلاب على الفرق المتاحة بنظام العدالة المتكافئة.`}
        confirmLabel="نعم، ابدأ التوزيع"
        variant="primary"
        onConfirm={handleExecute}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
