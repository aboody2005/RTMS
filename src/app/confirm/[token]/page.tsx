'use client';

import { useState, useEffect, use } from 'react';
import { Button } from '@/components/ui';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getCleanTeamName } from '@/lib/utils';
import styles from './confirm.module.css';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function ConfirmInvitationPage({ params }: PageProps) {
  const { token } = use(params);

  const [invitation, setInvitation] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'revoked' | 'expired' | 'error' | 'full' | 'cancelled'>('pending');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadInvitation() {
      try {
        const res = await fetch(`/api/confirm-invitation?token=${token}`);
        const data = await res.json();

        if (!res.ok) {
          setStatus('error');
          setErrorMessage(data.error === 'invitation_not_found' ? 'رابط الدعوة غير صحيح أو غير موجود' : 'حدث خطأ في تحميل الدعوة');
          return;
        }

        if (data.error) {
          if (data.error === 'invitation_confirmed') {
            setStatus('confirmed');
            setInvitation(data.invitation);
          } else if (data.error === 'invitation_revoked') {
            setStatus('revoked');
            setInvitation(data.invitation);
          } else if (data.error === 'invitation_expired') {
            setStatus('expired');
            setInvitation(data.invitation);
          }
          return;
        }

        setInvitation(data.invitation);
        setMembers(data.members || []);

        if (data.invitation?.status === 'confirmed') {
          setStatus('confirmed');
        } else {
          setStatus('pending');
        }
      } catch (err) {
        console.error(err);
        setStatus('error');
        setErrorMessage('تعذر الاتصال بالخادم، يرجى المحاولة مرة أخرى');
      } finally {
        setLoading(false);
      }
    }

    loadInvitation();
  }, [token]);

  const handleConfirm = async () => {
    setConfirming(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/confirm-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'team_at_capacity') {
          setStatus('full');
          setErrorMessage('عذراً، اكتملت السعة القصوى لهذا الفريق');
        } else if (data.error === 'student_already_confirmed') {
          setErrorMessage('أنت منضم بالفعل إلى فريق آخر في هذه المجموعة الدراسية');
        } else if (data.error === 'invitation_expired') {
          setStatus('expired');
          setErrorMessage('انتهت صلاحية هذا الرابط. يرجى طلب رابط دعوة جديد من قائد الفريق.');
        } else if (data.error === 'invitation_already_used' || data.error === 'invitation_confirmed') {
          setStatus('confirmed');
          setErrorMessage('تم استخدام هذا الرابط وتأكيد العضوية في الفريق مسبقاً.');
        } else if (data.error === 'invitation_revoked') {
          setStatus('revoked');
          setErrorMessage('تم إلغاء رابط الدعوة هذا من قبل قائد الفريق أو المشرف.');
        } else {
          setErrorMessage(data.message || data.error || 'حدث خطأ أثناء تأكيد الانضمام، يرجى المحاولة لاحقاً');
        }
        return;
      }

      setStatus('confirmed');
    } catch (err) {
      console.error(err);
      setErrorMessage('حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى');
    } finally {
      setConfirming(false);
    }
  };

  const studentName = invitation?.student?.full_name || '';
  const groupName = invitation?.team?.academic_group?.name || invitation?.student?.academic_group?.name || '';
  const teamName = getCleanTeamName(invitation?.team?.name, groupName);
  const leaderName = invitation?.team?.team_leader?.[0]?.student?.full_name || 'قائد الفريق';

  return (
    <div className={styles.page}>
      
      {/* Top Bar with Theme Toggle */}
      <div className={styles.topBar}>
        <ThemeToggle />
      </div>

      <div className={styles.cardContainer}>

        {/* Brand Header */}
        <div className={styles.brandHeader}>
          <div className={styles.brandLogo} aria-hidden="true">
            🐇
          </div>
          <h1 className={styles.title}>نظام إدارة فرق تجارب الأرانب</h1>
          <p className={styles.subtitle}>كلية الصيدلة • مختبر علم الأدوية العملي</p>
        </div>

        {/* Confirmation Card */}
        <div className={styles.confirmCard}>
          {loading ? (
            <div className={styles.statusView}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  border: '3px solid var(--primary)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }}
              />
              <p style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                جاري التحقق من الدعوة...
              </p>
            </div>
          ) : status === 'error' ? (
            <div className={styles.statusView}>
              <div className={styles.statusIcon} style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
                ⚠️
              </div>
              <h2 className={styles.statusHeading}>رابط غير صالح</h2>
              <p className={styles.statusDesc}>{errorMessage}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                يرجى التواصل مع قائد فريقك أو مشرف المختبر للحصول على رابط دعوة جديد.
              </p>
            </div>
          ) : status === 'revoked' ? (
            <div className={styles.statusView}>
              <div className={styles.statusIcon} style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
                🚫
              </div>
              <h2 className={styles.statusHeading}>تم إلغاء هذه الدعوة</h2>
              <p className={styles.statusDesc}>قام قائد الفريق أو المشرف بإلغاء رابط الدعوة هذا مسبقاً.</p>
            </div>
          ) : status === 'full' ? (
            <div className={styles.statusView}>
              <div className={styles.statusIcon} style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
                👥
              </div>
              <h2 className={styles.statusHeading}>الفريق مكتمل السعة</h2>
              <p className={styles.statusDesc}>{errorMessage}</p>
            </div>
          ) : status === 'cancelled' ? (
            <div className={styles.statusView}>
              <div className={styles.statusIcon} style={{ backgroundColor: 'var(--bg-surface-secondary)', color: 'var(--text-muted)' }}>
                ⏸️
              </div>
              <h2 className={styles.statusHeading}>لم يتم تأكيد الانضمام</h2>
              <p className={styles.statusDesc}>
                لقد قمت بإلغاء العملية. لم يتم تسجيلك في الفريق. يمكنك العودة لتأكيد انضمامك في أي وقت.
              </p>
              <Button variant="primary" onClick={() => setStatus('pending')}>
                العودة لتأكيد الانضمام
              </Button>
            </div>
          ) : status === 'confirmed' ? (
            <div className={styles.statusView}>
              <div className={styles.statusIcon} style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)' }}>
                🎉
              </div>
              <div>
                <h2 className={styles.statusHeading} style={{ color: 'var(--success-text)' }}>تهانينا! تم تأكيد انضمامك بنجاح</h2>
                <p className={styles.statusDesc} style={{ marginTop: '4px' }}>
                  أنت الآن عضو مسجل رسمياً في الفريق المختبري.
                </p>
              </div>

              <div className={styles.detailsBox}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>اسم الطالب:</span>
                  <span className={styles.detailValue}>{studentName}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>الفريق:</span>
                  <span className={styles.detailValue} style={{ color: 'var(--primary)' }}>🐇 {teamName}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>المجموعة الدراسية:</span>
                  <span className={styles.detailValue}>{groupName}</span>
                </div>
              </div>

              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                نتمنى لك ولفريقك التوفيق والنجاح في تجارب الأرانب العملية!
              </p>
            </div>
          ) : (
            /* Pending Invitation View */
            <div style={{ padding: 'var(--space-6) var(--space-7)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <div style={{ textAlign: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-4)' }}>
                <span className="status-badge status-badge-primary">
                  دعوة رسمية للانضمام إلى فريق
                </span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: 'var(--space-2)' }}>
                  مرحباً بك يا {studentName}
                </h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  المجموعة الدراسية: <strong>{groupName}</strong>
                </p>
              </div>

              {/* Team Details Box */}
              <div className={styles.teamBadgeBox}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>🐇 {teamName}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>قائد الفريق: {leaderName}</p>
                  </div>
                  <span className="status-badge status-badge-neutral">
                    السعة: {invitation?.team?.max_capacity || 6} طلاب
                  </span>
                </div>

                {members.length > 0 && (
                  <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>
                      أعضاء الفريق الحاليون:
                    </p>
                    <div className={styles.teamMembersRow}>
                      {members.map((m: any, idx: number) => (
                        <span key={idx} className={styles.memberChip}>
                          {m.is_leader && <span>👑</span>}
                          <span>{m.student?.full_name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="alert alert-error">
                  <span>✕</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Explicit Confirmation Question */}
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.9375rem', fontWeight: 700 }}>هل تؤكد انضمامك إلى الفريق؟</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  عند التأكيد، ستكتمل عضويتك في الفريق ولن يمكنك الانتقال لفريق آخر إلا عبر المشرف.
                </p>
              </div>

              {/* Action Buttons */}
              <div className={styles.actionBtns}>
                <Button
                  variant="primary"
                  onClick={handleConfirm}
                  disabled={confirming}
                  className={styles.confirmBtn}
                  size="lg"
                >
                  {confirming ? 'جاري تأكيد انضمامك...' : 'تأكيد الانضمام'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStatus('cancelled')}
                  disabled={confirming}
                  className={styles.cancelBtn}
                  size="lg"
                >
                  إلغاء
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <p className={styles.footerNote}>
          نظام إدارة فرق تجارب الأرانب • كلية الصيدلة
        </p>

      </div>
    </div>
  );
}
