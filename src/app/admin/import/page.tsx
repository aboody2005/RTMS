'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { PageHeader, Card, Button, EmptyState, TableWrapper, Th, Td, Badge, useToast } from '@/components/ui';
import { Select } from '@/components/ui/Input';
import type { AcademicGroup } from '@/types';

interface ParsedStudent {
  full_name: string;
  email?: string;
  phone?: string;
  academic_group_id?: string;
  import_status?: 'valid' | 'error';
  error_message?: string;
}

export default function ImportPage() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<AcademicGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ imported: number; skipped: number; updated: number; errors: { name: string; error: string }[] } | null>(null);
  const [resolveMode, setResolveMode] = useState<'skip' | 'update' | 'error'>('skip');
  const [textInput, setTextInput] = useState('');
  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/admin/groups').then(r => r.json()).then(d => setGroups(d.groups || []));
  }, []);

  const handleFileUpload = async (file: File) => {
    setParsedStudents([]);
    setImportResults(null);

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        toast.error('الملف فارغ أو لا يحتوي على أوراق عمل');
        return;
      }

      const rows: string[][] = [];
      worksheet.eachRow((row) => {
        const values: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          values.push(String(cell.value || ''));
        });
        rows.push(values);
      });

      if (rows.length < 2) {
        toast.error('الملف فارغ أو يحتوي على صف العناوين فقط');
        return;
      }

      const headers = rows[0];

      // Auto-detect columns (Name, Email)
      const nameIdx = headers.findIndex(h => /اسم|name/i.test(h));
      const emailIdx = headers.findIndex(h => /بريد|email/i.test(h));

      const students: ParsedStudent[] = rows.slice(1).map(row => ({
        full_name: row[nameIdx >= 0 ? nameIdx : 0]?.trim() || '',
        email: emailIdx >= 0 ? row[emailIdx]?.trim() : undefined,
        academic_group_id: selectedGroup || undefined,
        import_status: (!row[nameIdx >= 0 ? nameIdx : 0]?.trim() ? 'error' : 'valid') as 'valid' | 'error',
        error_message: !row[nameIdx >= 0 ? nameIdx : 0]?.trim() ? 'الاسم مطلوب' : undefined,
      }));

      setParsedStudents(students.filter(s => s.full_name));
    } else if (ext === 'csv' || ext === 'txt') {
      const text = await file.text();
      parseText(text, ext === 'csv');
    }
  };

  const parseText = (text: string, isCsv = false) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (isCsv && lines.length > 1) {
      const headers = lines[0].split(',').map(h => h.trim());
      const nameIdx = headers.findIndex(h => /اسم|name/i.test(h));
      const students = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        return {
          full_name: cols[nameIdx >= 0 ? nameIdx : 0] || '',
          academic_group_id: selectedGroup || undefined,
          import_status: 'valid' as const,
        };
      }).filter(s => s.full_name);
      setParsedStudents(students);
    } else {
      // Plain text: one name per line
      const students = lines.map(line => ({
        full_name: line.trim(),
        academic_group_id: selectedGroup || undefined,
        import_status: 'valid' as const,
      }));
      setParsedStudents(students);
    }
  };

  const handleImport = async () => {
    if (!selectedGroup) {
      toast.error('يرجى اختيار المجموعة الدراسية');
      return;
    }
    if (parsedStudents.length === 0) {
      toast.error('لا يوجد طلاب للاستيراد');
      return;
    }

    setImporting(true);
    const res = await fetch('/api/admin/students/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        students: parsedStudents.map(s => ({ ...s, academic_group_id: selectedGroup })),
        resolve_duplicates: resolveMode,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      setImportResults(data.results);
      toast.success(`تم الاستيراد: ${data.results.imported} طالب جديد، ${data.results.skipped} مكرر تم تجاهله، ${data.results.updated} تم تحديثه`);
      setParsedStudents([]);
    } else {
      toast.error(data.message || 'حدث خطأ أثناء الاستيراد');
    }
    setImporting(false);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [selectedGroup]);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="استيراد الطلاب"
        subtitle="رفع قوائم الطلاب من ملفات Excel أو CSV أو نص"
        breadcrumb={[{ label: 'الرئيسية', href: '/admin' }, { label: 'الطلاب', href: '/admin/students' }, { label: 'استيراد' }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration */}
        <div className="space-y-4">
          <Card>
            <h3 className="font-bold text-slate-800 mb-4">إعدادات الاستيراد</h3>
            <div className="space-y-4">
              <Select
                label="المجموعة الدراسية المستهدفة"
                required
                options={groups.map(g => ({ value: g.id, label: `المجموعة ${g.name}` }))}
                value={selectedGroup}
                onChange={e => setSelectedGroup(e.target.value)}
                placeholder="اختر المجموعة"
              />

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  معالجة الأسماء المكررة
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'skip', label: 'تجاهل المكرر', desc: 'تخطي الطالب إذا كان مسجلاً بالفعل في نفس المجموعة' },
                    { value: 'update', label: 'تحديث البيانات', desc: 'تحديث بيانات الطالب إذا كان مسجلاً' },
                    { value: 'error', label: 'إيقاف وإظهار خطأ', desc: 'تسجيل خطأ عند وجود اسم مكرر' },
                  ].map(opt => (
                    <label key={opt.value} className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                      <input
                        type="radio"
                        name="resolve_mode"
                        value={opt.value}
                        checked={resolveMode === opt.value}
                        onChange={() => setResolveMode(opt.value as any)}
                        className="mt-1"
                      />
                      <div>
                        <div className="text-sm font-medium text-slate-800">{opt.label}</div>
                        <div className="text-xs text-slate-400">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="font-bold text-slate-800 mb-3">تعليمات</h3>
            <ul className="text-sm text-slate-600 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>ملفات Excel (.xlsx): يجب أن يحتوي العمود الأول على الاسم</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>ملفات CSV: الصف الأول للعناوين، ثم البيانات</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>نص عادي: اسم واحد في كل سطر</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>يتم اكتشاف التكرار بالاسم ضمن نفس المجموعة الدراسية</span>
              </li>
            </ul>
          </Card>
        </div>

        {/* Upload area */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-2 mb-2">
            {[
              { key: 'file', label: 'رفع ملف', icon: '📁' },
              { key: 'text', label: 'نص مباشر', icon: '📝' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'file' | 'text')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'file' ? (
            <Card>
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
                  isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300'
                }`}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
              >
                <div className="text-5xl mb-4">📤</div>
                <h3 className="font-bold text-slate-700 mb-2">اسحب الملف هنا أو انقر للاختيار</h3>
                <p className="text-sm text-slate-400 mb-4">Excel (.xlsx)، CSV، أو ملف نصي</p>
                <Button
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                >
                  اختيار ملف
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                />
              </div>
            </Card>
          ) : (
            <Card>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">أدخل الأسماء (اسم واحد في كل سطر)</label>
                <textarea
                  className="w-full h-48 p-3 border border-slate-300 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none resize-y"
                  placeholder={`أحمد محمد علي\nسارة أحمد خالد\nمحمد عبدالله سعيد`}
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                />
                <Button
                  variant="secondary"
                  onClick={() => parseText(textInput)}
                  disabled={!textInput.trim()}
                >
                  تحليل النص
                </Button>
              </div>
            </Card>
          )}

          {/* Preview */}
          {parsedStudents.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800">
                  معاينة الاستيراد ({parsedStudents.length} طالب)
                </h3>
                <Button
                  onClick={handleImport}
                  loading={importing}
                  disabled={!selectedGroup}
                  size="sm"
                >
                  استيراد الآن
                </Button>
              </div>

              <TableWrapper>
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>الاسم</Th>
                    <Th>الحالة</Th>
                  </tr>
                </thead>
                <tbody>
                  {parsedStudents.slice(0, 20).map((student, idx) => (
                    <tr key={idx} className={student.import_status === 'error' ? 'bg-red-50' : ''}>
                      <Td className="text-slate-400">{idx + 1}</Td>
                      <Td className="font-medium">{student.full_name || <span className="text-red-400">—</span>}</Td>
                      <Td>
                        {student.import_status === 'error' ? (
                          <span className="text-xs text-red-600">⚠ {student.error_message}</span>
                        ) : (
                          <span className="text-xs text-green-600">✓ صالح</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                  {parsedStudents.length > 20 && (
                    <tr>
                      <Td colSpan={3} className="text-center text-sm text-slate-400">
                        ... و {parsedStudents.length - 20} طالب آخر
                      </Td>
                    </tr>
                  )}
                </tbody>
              </TableWrapper>
            </Card>
          )}

          {/* Import results */}
          {importResults && (
            <Card>
              <h3 className="font-bold text-slate-800 mb-3">نتائج الاستيراد</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">{importResults.imported}</div>
                  <div className="text-xs text-green-700">تم استيرادهم</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-slate-600">{importResults.skipped}</div>
                  <div className="text-xs text-slate-700">تم تجاهلهم (مكرر)</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">{importResults.updated}</div>
                  <div className="text-xs text-blue-700">تم تحديثهم</div>
                </div>
              </div>

              {importResults.errors.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-700 mb-2">أخطاء ({importResults.errors.length}):</h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {importResults.errors.map((err, i) => (
                      <div key={i} className="text-xs text-red-600 flex justify-between p-1 bg-red-50 rounded">
                        <span>{err.name}</span>
                        <span>{err.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
