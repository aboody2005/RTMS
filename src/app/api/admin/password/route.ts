import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// POST /api/admin/password
// Allows the logged-in admin to securely change their password
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'unauthorized', message: 'غير مصرح بالوصول، يرجى تسجيل الدخول أولاً' }, { status: 401 });
    }

    const body = await request.json();
    const { current_password, new_password, confirm_password } = body;

    if (!new_password || typeof new_password !== 'string') {
      return NextResponse.json({ error: 'new_password_required', message: 'يرجى إدخال كلمة المرور الجديدة' }, { status: 400 });
    }

    if (new_password.length < 6) {
      return NextResponse.json({ error: 'password_too_short', message: 'يجب أن تتكون كلمة المرور من 6 أحرف أو أرقام على الأقل' }, { status: 400 });
    }

    if (new_password !== confirm_password) {
      return NextResponse.json({ error: 'passwords_mismatch', message: 'كلمة المرور الجديدة وتأكيدها غير متطابقين' }, { status: 400 });
    }

    // If current_password is provided, verify it
    if (current_password && user.email) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: current_password,
      });

      if (signInErr) {
        return NextResponse.json({ error: 'wrong_current_password', message: 'كلمة المرور الحالية غير صحيحة' }, { status: 400 });
      }
    }

    // Update the password using Admin client for reliability
    const adminSupabase = await createAdminClient();
    const { error: updateErr } = await adminSupabase.auth.admin.updateUserById(user.id, {
      password: new_password,
    });

    if (updateErr) {
      console.error('Password update error:', updateErr);
      return NextResponse.json({ error: 'update_failed', message: 'فشل في تحديث كلمة المرور: ' + updateErr.message }, { status: 500 });
    }

    // Record in audit log
    await adminSupabase.from('audit_logs').insert({
      action: 'admin_password_change',
      performed_by: user.id,
      performed_by_name: user.email,
      details: {
        email: user.email,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح! يمكنك الآن استخدام كلمة المرور الجديدة لتسجيل الدخول.',
    });
  } catch (err: any) {
    console.error('Unexpected error in password route:', err);
    return NextResponse.json({ error: 'server_error', message: err.message || 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
