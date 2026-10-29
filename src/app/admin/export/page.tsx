'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Card, Button, useToast } from '@/components/ui';
import type { AcademicGroup } from '@/types';

export default function ExportPage() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<AcademicGroup[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [includePending, setIncludePending] = useState(true);
  const [includeUnassigned, setIncludeUnassigned] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/groups')
      .then(res => res.json())
      .then(data => {
        const list = data.groups || [];
        setGroups(list);
        // By default select all
        setSelectedGroupIds(list.map((g: any) => g.id));
      })
      .catch(console.error);
  }, []);

  const handleToggleGroup = (id: string) => {
    setSelectedGroupIds(prev =>
      prev.includes(id) ? prev.filter(gId => gId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedGroupIds.length === groups.length) {
      setSelectedGroupIds([]);
    } else {
      setSelectedGroupIds(groups.map(g => g.id));
    }
  };

  const handleExport = async () => {
    if (selectedGroupIds.length === 0) {
      toast('يرجى اختيار مجموعة واحدة على الأقل للتصدير', { type: 'error' });
      return;
    }

    setDownloading(true);
    try {
      const res = await fetch('/api/admin/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_ids: selectedGroupIds,
          include_pending: includePending,
          include_unassigned: includeUnassigned,
        }),
      });

      if (!res.ok) {
        throw new Error('فشل في تصدير ملف Excel');
      }

      // Convert to blob and trigger download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `فرق-مختبر-علم-الأدوية-العملي-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast('تم تنزيل ملف Excel بنجاح!', { type: 'success' });
    } catch (err: any) {
      toast(err.message, { type: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="تصدير النتائج إلى Excel"
        subtitle="تصدير بيانات وتوزيعات فرق مختبر علم الأدوية العملي بصيغة ملف Excel منسق واحترافي باللغة العربية"
        breadcrumb={[
          { label: 'الرئيسية', href: '/admin' },
          { label: 'تصدير Excel' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selection & Options (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-base">المجموعات الدراسية المراد تصديرها</h3>
                <p className="text-xs text-slate-500">سيتم إنشاء ورقة عمل (Sheet) منفصلة لكل مجموعة دراسية محددة</p>
              </div>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
              >
                {selectedGroupIds.length === groups.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groups.map(group => {
                const isSelected = selectedGroupIds.includes(group.id);
                return (
                  <label
                    key={group.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 text-blue-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleGroup(group.id)}
                      className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <div>
                      <p className="text-sm font-bold">{group.name}</p>
                      <p className="text-xs text-slate-500">الحد الأقصى: {group.max_students} طالب</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </Card>

          <Card>
            <h3 className="font-bold text-slate-800 text-base mb-4">خيارات ومحتويات التصدير</h3>
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePending}
                  onChange={(e) => setIncludePending(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <div>
                  <span className="text-sm font-semibold text-slate-800">تضمين الدعوات المعلقة (في انتظار التأكيد)</span>
                  <p className="text-xs text-slate-500">تظهر مميزة بلون أصفر مخصص داخل قسم كل فريق</p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeUnassigned}
                  onChange={(e) => setIncludeUnassigned(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <div>
                  <span className="text-sm font-semibold text-slate-800">تضمين قسم الطلاب غير الموزعين</span>
                  <p className="text-xs text-slate-500">إضافة جدول منفصل أسفل الورقة للطلاب الذين لم ينضموا بعد إلى أي فريق</p>
                </div>
              </label>
            </div>
          </Card>
        </div>

        {/* Export Summary & Action (1 col) */}
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50/40 border-green-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-600 text-white flex items-center justify-center text-xl shadow-md">
                📊
              </div>
              <div>
                <h3 className="font-bold text-green-950 text-base">تنسيق المصنف</h3>
                <p className="text-xs text-green-700">Microsoft Excel (.xlsx)</p>
              </div>
            </div>

            <ul className="text-xs text-green-900 space-y-2 mb-6">
              <li className="flex items-center gap-2">
                <span>✅</span> <span>محاذاة كاملة من اليمين إلى اليسار (RTL)</span>
              </li>
              <li className="flex items-center gap-2">
                <span>✅</span> <span>عناوين ملونة وترويسات احترافية</span>
              </li>
              <li className="flex items-center gap-2">
                <span>✅</span> <span>تمييز قادة الفرق بالألوان</span>
              </li>
              <li className="flex items-center gap-2">
                <span>✅</span> <span>عرض سعة كل فريق والأماكن المتبقية</span>
              </li>
            </ul>

            <Button
              variant="primary"
              onClick={handleExport}
              disabled={downloading || selectedGroupIds.length === 0}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 shadow-md"
            >
              {downloading ? 'جاري تجهيز وتنزيل الملف...' : `📥 تصدير (${selectedGroupIds.length}) مجموعات`}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
