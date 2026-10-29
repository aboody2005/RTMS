'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Card, Button, Modal, ConfirmDialog, useToast } from '@/components/ui';
import { Input, Select } from '@/components/ui/Input';
import type { AcademicGroup } from '@/types';

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>({
    default_group_capacity: 41,
    default_teams_per_group: 8,
    default_team_capacity: 6,
    leader_included_in_capacity: true,
    random_distribution_auto_confirm: true,
    experiment_title: 'مختبر علم الأدوية العملي - تجارب الأرانب',
    faculty_name: 'كلية الصيدلة',
  });

  const [groups, setGroups] = useState<AcademicGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Bulk update existing teams modal state
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkScope, setBulkScope] = useState<'group' | 'all'>('group');
  const [bulkGroupId, setBulkGroupId] = useState<string>('');
  const [bulkNewCapacity, setBulkNewCapacity] = useState<number>(5);
  const [excludeConflicts, setExcludeConflicts] = useState<boolean>(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<{
    total_teams: number;
    eligible_teams_count: number;
    conflict_teams_count: number;
    eligible_teams: any[];
    conflict_teams: any[];
    new_capacity: number;
  } | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [updatingBulk, setUpdatingBulk] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      toast('يرجى إدخال كلمة المرور الجديدة', { type: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      toast('يجب أن تتكون كلمة المرور من 6 أحرف على الأقل', { type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('كلمة المرور وتأكيدها غير متطابقين', { type: 'error' });
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch('/api/admin/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'فشل في تغيير كلمة المرور');
      }

      toast(data.message || 'تم تغيير كلمة المرور بنجاح!', { type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast(err.message, { type: 'error' });
    } finally {
      setChangingPassword(false);
    }
  };

  // Load settings & groups
  useEffect(() => {
    Promise.all([
      fetch('/api/admin/settings').then(res => res.json()),
      fetch('/api/admin/groups').then(res => res.json()),
    ])
      .then(([settingsData, groupsData]) => {
        if (settingsData.settings) {
          setSettings((prev: any) => ({
            ...prev,
            ...settingsData.settings,
          }));
          if (settingsData.settings.default_team_capacity) {
            setBulkNewCapacity(Number(settingsData.settings.default_team_capacity));
          }
        }
        const grps = groupsData.groups || [];
        setGroups(grps);
        if (grps.length > 0) {
          setBulkGroupId(grps[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Save default system settings
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });

      if (!res.ok) throw new Error('فشل في حفظ الإعدادات');

      toast('تم حفظ إعدادات النظام بنجاح! سيتم تطبيق السعة الافتراضية على أي فرق جديدة يتم إنشاؤها مستقبلاً.', {
        type: 'success',
      });
    } catch (err: any) {
      toast(err.message, { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Open Bulk Modal & initialize analysis
  const openBulkModal = () => {
    setBulkNewCapacity(Number(settings.default_team_capacity) || 5);
    setBulkScope('group');
    if (groups.length > 0 && !bulkGroupId) {
      setBulkGroupId(groups[0].id);
    }
    setAnalysis(null);
    setBulkModalOpen(true);
    // Trigger initial preview analysis
    triggerAnalysis('group', bulkGroupId || groups[0]?.id || '', Number(settings.default_team_capacity) || 5);
  };

  // Run preview analysis
  const triggerAnalysis = async (scope: 'group' | 'all', groupId: string, capacity: number) => {
    setAnalyzing(true);
    try {
      const url = `/api/admin/teams/bulk-capacity?scope=${scope}&group_id=${groupId || ''}&new_capacity=${capacity}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setAnalysis(data);
      }
    } catch (err) {
      console.error('Error analyzing teams:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  // Handle scope or group or capacity change in modal
  const handleScopeChange = (newScope: 'group' | 'all') => {
    setBulkScope(newScope);
    triggerAnalysis(newScope, bulkGroupId, bulkNewCapacity);
  };

  const handleGroupChange = (newGroupId: string) => {
    setBulkGroupId(newGroupId);
    triggerAnalysis(bulkScope, newGroupId, bulkNewCapacity);
  };

  const handleCapacityChange = (newCap: number) => {
    setBulkNewCapacity(newCap);
    triggerAnalysis(bulkScope, bulkGroupId, newCap);
  };

  // Execute bulk update
  const handleExecuteBulkUpdate = async () => {
    setUpdatingBulk(true);
    try {
      const res = await fetch('/api/admin/teams/bulk-capacity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: bulkScope,
          group_id: bulkScope === 'group' ? bulkGroupId : undefined,
          new_capacity: bulkNewCapacity,
          exclude_conflicts: excludeConflicts,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'فشل في تحديث سعة الفرق');
      }

      setConfirmOpen(false);
      setBulkModalOpen(false);
      toast(data.message || `تم تحديث سعة ${data.updated_count} فرق بنجاح إلى ${bulkNewCapacity} طلاب.`, {
        type: 'success',
      });
    } catch (err: any) {
      toast(err.message, { type: 'error' });
      setConfirmOpen(false);
    } finally {
      setUpdatingBulk(false);
    }
  };

  const selectedGroupName = groups.find(g => g.id === bulkGroupId)?.name || '';

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
      <PageHeader
        title="إعدادات النظام"
        subtitle="تخصيص القواعد الافتراضية للفرق والمجموعات، والتحكم في سعات الفرق القائمة والجديدة"
        breadcrumb={[
          { label: 'الرئيسية', href: '/admin' },
          { label: 'الإعدادات' },
        ]}
      />



      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-16) 0' }}>
          <div className="inline-block animate-spin" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '4px solid var(--primary-solid)', borderTopColor: 'transparent', margin: '0 auto' }} />
          <p style={{ marginTop: 'var(--spacing-3)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>جاري تحميل الإعدادات...</p>
        </div>
      ) : (
        <>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* General info */}
            <Card>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 'var(--spacing-4)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                <span>🏛️</span> معلومات الكلية والمختبر
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
                <Input
                  label="عنوان التجربة / المختبر"
                  value={settings.experiment_title || ''}
                  onChange={(e) => setSettings({ ...settings, experiment_title: e.target.value })}
                />
                <Input
                  label="اسم الكلية / القسم"
                  value={settings.faculty_name || ''}
                  onChange={(e) => setSettings({ ...settings, faculty_name: e.target.value })}
                />
              </div>
            </Card>

            {/* Team rules & Dedicated Bulk Update Action */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-4)', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', margin: 0 }}>
                  <span>👥</span> قواعد وسعات الفرق
                </h3>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={openBulkModal}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>⚡</span> تحديث الفرق الموجودة
                </Button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
                <div>
                  <Input
                    label="السعة الافتراضية للفريق (للفرق الجديدة المستحدثة)"
                    type="number"
                    min={2}
                    max={20}
                    value={settings.default_team_capacity}
                    onChange={(e) => setSettings({ ...settings, default_team_capacity: Number(e.target.value) })}
                    hint="تُطبق هذه السعة تلقائياً كقيمة افتراضية عند إنشاء فرق جديدة في النظام."
                  />
                  <div style={{ marginTop: 'var(--spacing-2)', padding: 'var(--spacing-2.5) var(--spacing-3)', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    💡 <strong>ملاحظة هامة:</strong> تغيير السعة الافتراضية هنا يؤثر على الفرق الجديدة فقط ولا يغير سعات الفرق القائمة تلقائياً حفاظاً على استقرار السجلات. لتطبيق سعة جديدة على الفرق القائمة، اضغط على زر <strong>&quot;تحديث الفرق الموجودة&quot;</strong> أعلاه.
                  </div>
                </div>

                <Input
                  label="العدد الافتراضي للفرق في كل مجموعة دراسية"
                  type="number"
                  min={1}
                  max={30}
                  value={settings.default_teams_per_group}
                  onChange={(e) => setSettings({ ...settings, default_teams_per_group: Number(e.target.value) })}
                  hint="عدد الفرق المقترح افتراضياً في المعالج المجمع."
                />

                <Input
                  label="الحد الأقصى الافتراضي لعدد الطلاب في المجموعة الدراسية"
                  type="number"
                  min={10}
                  max={200}
                  value={settings.default_group_capacity}
                  onChange={(e) => setSettings({ ...settings, default_group_capacity: Number(e.target.value) })}
                  hint="سعة الشعبة الأكاديمية المستقلة."
                />
              </div>
            </Card>
          </div>

          {/* Behavior Toggles */}
          <Card>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 'var(--spacing-4)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
              <span>⚙️</span> سلوك النظام وسياسات التأكيد
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-3)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.leader_included_in_capacity === true || settings.leader_included_in_capacity === 'true'}
                  onChange={(e) => setSettings({ ...settings, leader_included_in_capacity: e.target.checked })}
                  style={{ marginTop: '4px' }}
                />
                <div>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    احتساب قائد الفريق ضمن السعة الإجمالية للفريق
                  </span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    إذا تم التفعيل، فإن فريق بسعة 6 طلاب سيحتوي على قائد الفريق + 5 أعضاء كحد أقصى.
                  </p>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-3)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.random_distribution_auto_confirm === true || settings.random_distribution_auto_confirm === 'true'}
                  onChange={(e) => setSettings({ ...settings, random_distribution_auto_confirm: e.target.checked })}
                  style={{ marginTop: '4px' }}
                />
                <div>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    تأكيد الطلاب الموزعين عشوائياً تلقائياً
                  </span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    عند التوزيع العشوائي، يتم تثبيت الطلاب في الفرق مباشرة دون إنشاء دعوات مؤقتة.
                  </p>
                </div>
              </label>
            </div>
          </Card>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-3)' }}>
            <Button variant="primary" type="submit" disabled={saving} style={{ minWidth: '160px' }}>
              {saving ? 'جاري الحفظ...' : 'تحديث السعة الافتراضية'}
            </Button>
          </div>
        </form>

        {/* Admin Account & Password Management Card */}
        <div style={{ marginTop: 'var(--spacing-6)' }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-4)', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', margin: 0 }}>
                <span>🔐</span> أمان الحساب وتغيير كلمة مرور المشرف
              </h3>
              <span className="badge badge-primary" style={{ direction: 'ltr' }}>
                admin@pharmacy.edu
              </span>
            </div>

            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--spacing-4)' }}>
                <div>
                  <Input
                    label="كلمة المرور الحالية"
                    type={showPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    hint="كلمة المرور الحالية المسجلة لحسابك"
                  />
                </div>

                <div>
                  <Input
                    label="كلمة المرور الجديدة"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور الجديدة"
                    hint="يجب أن تتكون من 6 خانات على الأقل"
                    required
                  />
                </div>

                <div>
                  <Input
                    label="تأكيد كلمة المرور الجديدة"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="أعد إدخال كلمة المرور الجديدة"
                    hint="يجب أن تطابق كلمة المرور الجديدة"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--spacing-3)', paddingTop: 'var(--spacing-2)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                  />
                  <span>إظهار كلمات المرور</span>
                </label>

                <Button
                  variant="primary"
                  type="submit"
                  disabled={changingPassword || !newPassword}
                  style={{ minWidth: '170px' }}
                >
                  {changingPassword ? 'جاري التحديث...' : '🔐 حفظ كلمة المرور الجديدة'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </>
    )}

      {/* Modal: Update Existing Teams */}
      <Modal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title="تحديث الفرق الموجودة"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-5)' }}>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            يتيح لك هذا الإجراء تطبيق سعة جديدة على الفرق المُنشأة مسبقاً في قاعدة البيانات بأمان. يمكنك اختيار تحديث فرق مجموعة دراسية محددة أو جميع الفرق في النظام.
          </p>

          {/* Scope Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
              نطاق التحديث:
            </label>
            <div style={{ display: 'flex', gap: 'var(--spacing-4)', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="radio"
                  name="bulkScope"
                  value="group"
                  checked={bulkScope === 'group'}
                  onChange={() => handleScopeChange('group')}
                />
                <span>تحديث فرق مجموعة محددة (موصى به)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="radio"
                  name="bulkScope"
                  value="all"
                  checked={bulkScope === 'all'}
                  onChange={() => handleScopeChange('all')}
                />
                <span>تحديث جميع الفرق في النظام</span>
              </label>
            </div>
          </div>

          {/* Group dropdown if scope is group */}
          {bulkScope === 'group' && (
            <Select
              label="المجموعة الدراسية المستهدفة"
              value={bulkGroupId}
              onChange={(e) => handleGroupChange(e.target.value)}
              options={groups.map(g => ({ value: g.id, label: `المجموعة ${g.name}` }))}
              required
            />
          )}

          {/* New Capacity Input */}
          <Input
            label="السعة الجديدة المراد تطبيقها على الفرق"
            type="number"
            min={2}
            max={20}
            value={bulkNewCapacity}
            onChange={(e) => handleCapacityChange(Number(e.target.value))}
            hint="السعة القصوى الجديدة لعدد الطلاب في كل فريق من الفرق المشمولة."
            required
          />

          {/* Analysis & Conflict Preview */}
          {analyzing ? (
            <div style={{ padding: 'var(--spacing-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              جاري فحص الفرق وتحليل العضويات المؤكدة...
            </div>
          ) : analysis ? (
            <div
              style={{
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--spacing-4)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-3)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  نطاق الفحص: <strong>{bulkScope === 'all' ? 'جميع المجموعات' : `المجموعة ${selectedGroupName}`}</strong>
                </span>
                <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>
                  عدد الفرق المتأثرة: {analysis.total_teams} فرق
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-2)', fontSize: '0.8rem' }}>
                <div style={{ padding: 'var(--spacing-2) var(--spacing-3)', backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: 'var(--radius-md)', color: 'var(--success-solid)' }}>
                  ✅ فرق مؤهلة للتحديث: <strong>{analysis.eligible_teams_count}</strong>
                </div>
                <div style={{ padding: 'var(--spacing-2) var(--spacing-3)', backgroundColor: analysis.conflict_teams_count > 0 ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-card)', border: '1px solid ' + (analysis.conflict_teams_count > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-subtle)'), borderRadius: 'var(--radius-md)', color: analysis.conflict_teams_count > 0 ? 'var(--danger-solid)' : 'var(--text-muted)' }}>
                  {analysis.conflict_teams_count > 0 ? `⚠️ فرق متعارضة: ${analysis.conflict_teams_count}` : 'لا توجد تعارضات'}
                </div>
              </div>

              {/* Conflict Warnings */}
              {analysis.conflict_teams_count > 0 && (
                <div style={{ marginTop: 'var(--spacing-2)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--danger-solid)' }}>
                    الفرق التي لا يمكن تحديثها (بها أعضاء مؤكدون أكثر من السعة الجديدة {bulkNewCapacity}):
                  </p>
                  <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {analysis.conflict_teams.map((t: any) => (
                      <div
                        key={t.id}
                        style={{
                          fontSize: '0.72rem',
                          padding: '4px 8px',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{t.name}</span>
                        <span style={{ color: 'var(--danger-solid)' }}>
                          عدد الأعضاء المؤكدين: <strong>{t.confirmed_count}</strong> &gt; السعة الجديدة: <strong>{bulkNewCapacity}</strong>
                        </span>
                      </div>
                    ))}
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-main)', marginTop: '4px' }}>
                    <input
                      type="checkbox"
                      checked={excludeConflicts}
                      onChange={(e) => setExcludeConflicts(e.target.checked)}
                    />
                    <span>استثناء هذه الفرق المتعارضة وتحديث باقي الفرق المؤهلة ({analysis.eligible_teams_count} فرق) بأمان دون حذف أو إسقاط أي طالب</span>
                  </label>
                </div>
              )}
            </div>
          ) : null}

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-3)', paddingTop: 'var(--spacing-3)', borderTop: '1px solid var(--border-subtle)' }}>
            <Button variant="secondary" onClick={() => setBulkModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={analyzing || !analysis || analysis.eligible_teams_count === 0}
              onClick={() => setConfirmOpen(true)}
            >
              متابعة تأكيد التحديث ({analysis ? analysis.eligible_teams_count : 0} فرق)
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title="تأكيد تحديث سعة الفرق القائمة"
        message={
          analysis ? (
            `أنت على وشك تحديث سعة ${analysis.eligible_teams_count} فرق في نطاق (${bulkScope === 'all' ? 'جميع الفرق' : `المجموعة ${selectedGroupName}`}) إلى سعة جديدة (${bulkNewCapacity} طلاب لكل فريق).${
              analysis.conflict_teams_count > 0
                ? ` سيتم استثناء ${analysis.conflict_teams_count} فرق متعارضة تضم حالياً أكثر من ${bulkNewCapacity} طلاب حفاظاً على سجلاتهم.`
                : ''
            } هل تود الاستمرار وتطبيق التحديث على قاعدة البيانات؟`
          ) : 'هل تود الاستمرار وتطبيق التحديث؟'
        }
        confirmLabel="تأكيد التحديث الآن"
        variant="warning"
        onConfirm={handleExecuteBulkUpdate}
        onCancel={() => setConfirmOpen(false)}
        loading={updatingBulk}
      />
    </div>
  );
}
