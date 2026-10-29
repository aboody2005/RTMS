'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@/lib/validations';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { z } from 'zod';
import styles from './login.module.css';

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError('');

    let inputEmail = data.email.trim();
    if (!inputEmail.includes('@')) {
      inputEmail = `${inputEmail}@pharmacy.edu`;
    }

    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: inputEmail,
      password: data.password.trim(),
    });

    if (authError) {
      console.error('Sign-in error:', authError);
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى التأكد من كتابة البريد وكلمة المرور بدقة.');
      setLoading(false);
      return;
    }

    // Full navigation ensures cookies are immediately passed to middleware & server components
    window.location.href = '/admin';
  };

  return (
    <div className={styles.page}>

      {/* Top Bar with Back Link and Theme Toggle */}
      <div className={styles.topBar}>
        <Link href="/" className={styles.backLink}>
          <span>←</span>
          <span>العودة للرئيسية</span>
        </Link>
        <ThemeToggle />
      </div>

      <div className={styles.cardContainer}>

        {/* Brand Header */}
        <div className={styles.brandHeader}>
          <div className={styles.brandLogo} aria-hidden="true">
            🐇
          </div>
          <h1 className={styles.title}>نظام إدارة فرق تجارب الأرانب</h1>
          <p className={styles.subtitle}>تسجيل دخول المشرف • كلية الصيدلة</p>
        </div>

        {/* Login Card */}
        <div className={styles.loginCard}>
          <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
            {error && (
              <Alert type="error" message={error} onClose={() => setError('')} />
            )}

            {/* Email Field */}
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                البريد الإلكتروني أو اسم المستخدم
                <span style={{ color: 'var(--danger-solid)', marginInlineStart: '4px' }}>*</span>
              </label>
              <input
                id="email"
                type="text"
                autoComplete="email"
                placeholder="admin@pharmacy.edu"
                className={`form-input ${errors.email ? 'form-input-error' : ''}`}
                {...register('email')}
              />
              {errors.email && (
                <p className="form-error-msg">
                  <span>✕</span>
                  <span>{errors.email.message}</span>
                </p>
              )}
            </div>

            {/* Password Field with Show/Hide Toggle */}
            <div className="form-group">
              <label htmlFor="password" className="form-label">
                كلمة المرور
                <span style={{ color: 'var(--danger-solid)', marginInlineStart: '4px' }}>*</span>
              </label>
              <div className={styles.passwordWrapper}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`form-input ${errors.password ? 'form-input-error' : ''}`}
                  style={{ paddingInlineEnd: '64px' }}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={styles.passwordToggleBtn}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? 'إخفاء' : 'إظهار'}
                </button>
              </div>
              {errors.password && (
                <p className="form-error-msg">
                  <span>✕</span>
                  <span>{errors.password.message}</span>
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className={styles.submitBtn}
              loading={loading}
              size="lg"
            >
              تسجيل الدخول
            </Button>
          </form>
        </div>

        {/* Footer Note */}
        <p className={styles.footerNote}>
          نظام إدارة فرق تجارب الأرانب — مختبر علم الأدوية العملي
        </p>

      </div>
    </div>
  );
}
