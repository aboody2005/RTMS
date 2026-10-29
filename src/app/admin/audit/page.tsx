'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  PageHeader, Card, Button, TableWrapper, Th, Td, EmptyState, Modal
} from '@/components/ui';
import { formatDate } from '@/lib/utils';

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedAction, setSelectedAction] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/admin/audit?page=${page}&limit=25`;
      if (selectedAction) url += `&action=${selectedAction}`;

      const res = await fetch(url);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, selectedAction]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionInfo = (action: string) => {
    const map: Record<string, { label: string; color: string; icon: string }> = {
      student_import: { label: 'استيراد طلاب', color: 'bg-blue-100 text-blue-800', icon: '📥' },
      student_create: { label: 'إضافة طالب', color: 'bg-blue-50 text-blue-700', icon: '👨‍🎓' },
      student_update: { label: 'تعديل طالب', color: 'bg-slate-100 text-slate-700', icon: '✏️' },
      student_delete: { label: 'حذف طالب', color: 'bg-red-100 text-red-700', icon: '🗑️' },
      group_create: { label: 'إنشاء مجموعة', color: 'bg-indigo-100 text-indigo-800', icon: '🎓' },
      group_update: { label: 'تعديل مجموعة', color: 'bg-slate-100 text-slate-700', icon: '✏️' },
      team_create: { label: 'إنشاء فريق', color: 'bg-purple-100 text-purple-800', icon: '🐇' },
      team_update: { label: 'تعديل فريق', color: 'bg-slate-100 text-slate-700', icon: '✏️' },
      team_delete: { label: 'حذف فريق', color: 'bg-red-100 text-red-700', icon: '🗑️' },
      leader_assign: { label: 'تعيين قائد', color: 'bg-amber-100 text-amber-800', icon: '👑' },
      leader_link_generate: { label: 'توليد رابط قائد', color: 'bg-amber-50 text-amber-700', icon: '🔗' },
      leader_link_revoke: { label: 'إلغاء رابط قائد', color: 'bg-red-50 text-red-700', icon: '❌' },
      invitation_create: { label: 'إنشاء دعوة', color: 'bg-yellow-100 text-yellow-800', icon: '✉️' },
      invitation_revoke: { label: 'إلغاء دعوة', color: 'bg-red-100 text-red-700', icon: '🚫' },
      membership_confirm: { label: 'تأكيد انضمام', color: 'bg-green-100 text-green-800', icon: '✅' },
      membership_remove: { label: 'إزالة عضو', color: 'bg-red-100 text-red-700', icon: '👤' },
      random_distribution: { label: 'توزيع عشوائي', color: 'bg-purple-100 text-purple-800', icon: '🎲' },
      admin_reassign: { label: 'إعادة توزيع', color: 'bg-blue-100 text-blue-800', icon: '🔄' },
      settings_change: { label: 'تغيير الإعدادات', color: 'bg-slate-100 text-slate-700', icon: '⚙️' },
    };
    return map[action] || { label: action, color: 'bg-slate-100 text-slate-700', icon: '📋' };
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="سجل العمليات والرقابة"
        subtitle="سجل تفصيلي ودقيق لجميع العمليات والتعديلات المنفذة في النظام"
        breadcrumb={[
          { label: 'الرئيسية', href: '/admin' },
          { label: 'سجل العمليات' },
        ]}
      />

      {/* Filter */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-700">نوع العملية:</label>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">جميع العمليات</option>
              <option value="student_import">استيراد طلاب</option>
              <option value="team_create">إنشاء فرق</option>
              <option value="leader_assign">تعيين قادة فرق</option>
              <option value="invitation_create">إنشاء دعوات</option>
              <option value="invitation_revoke">إلغاء دعوات</option>
              <option value="membership_confirm">تأكيد انضمام</option>
              <option value="membership_remove">إزالة أعضاء من الفرق</option>
              <option value="random_distribution">توزيع عشوائي</option>
              <option value="settings_change">تغيير إعدادات</option>
            </select>
          </div>

          <span className="text-xs text-slate-500 font-medium">
            إجمالي العمليات المسجلة: {total}
          </span>
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-500">جاري تحميل السجل...</p>
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          title="لا توجد عمليات مسجلة"
          description="لم يتم العثور على سجلات تطابق الفلترة المحددة"
        />
      ) : (
        <div className="space-y-4">
          <TableWrapper>
            <thead>
              <tr>
                <Th>الوقت والتاريخ</Th>
                <Th>العملية</Th>
                <Th>المنفّذ</Th>
                <Th>الهدف / المعني</Th>
                <Th>التفاصيل</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => {
                const info = getActionInfo(log.action);
                const targetText =
                  log.target_team?.name ? `فريق: ${log.target_team.name}` :
                  log.target_student?.full_name ? `طالب: ${log.target_student.full_name}` :
                  log.target_group?.name ? `مجموعة: ${log.target_group.name}` :
                  '—';

                return (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <Td className="text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </Td>
                    <Td>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${info.color}`}>
                        <span>{info.icon}</span>
                        <span>{info.label}</span>
                      </span>
                    </Td>
                    <Td className="text-xs font-medium text-slate-800">
                      {log.performed_by_name || log.performer?.full_name || 'مدير النظام'}
                    </Td>
                    <Td className="text-xs text-slate-700">
                      {targetText}
                    </Td>
                    <Td>
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors font-medium"
                      >
                        عرض التفاصيل
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrapper>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between py-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded border border-slate-300 text-xs font-medium disabled:opacity-40 hover:bg-slate-50"
              >
                ← الصفحة السابقة
              </button>
              <span className="text-xs text-slate-600">
                صفحة {page} من {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded border border-slate-300 text-xs font-medium disabled:opacity-40 hover:bg-slate-50"
              >
                الصفحة التالية →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="تفاصيل العملية المسجلة"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <span className="text-slate-400 block mb-0.5">العملية:</span>
              <span className="font-bold text-slate-800">{getActionInfo(selectedLog?.action || '').label}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">التاريخ والوقت:</span>
              <span className="font-semibold text-slate-800">{formatDate(selectedLog?.created_at)}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">المنفّذ:</span>
              <span className="font-semibold text-slate-800">
                {selectedLog?.performed_by_name || selectedLog?.performer?.full_name || 'النظام'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">معرف العملية:</span>
              <span className="font-mono text-slate-600 text-[11px]">{selectedLog?.id}</span>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-700 mb-1">البيانات الإضافية (Payload):</p>
            <pre className="text-xs font-mono p-3 bg-slate-900 text-green-400 rounded-lg overflow-x-auto max-h-60 dir-ltr text-left">
              {JSON.stringify(selectedLog?.details || selectedLog?.new_values || {}, null, 2)}
            </pre>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={() => setSelectedLog(null)}>
              إغلاق
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
