import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <div className={styles.page}>

      {/* Top Navigation */}
      <header className={styles.header}>
        <div className={`container-xl ${styles.headerInner}`}>
          
          {/* Logo & Academic Title */}
          <Link href="/" className={styles.brand}>
            <div className={styles.brandLogo} aria-hidden="true">
              🐇
            </div>
            <div className={styles.brandText}>
              <span className={styles.brandTitle}>
                نظام إدارة فرق التجارب
              </span>
              <span className={styles.brandSubtitle}>
                كلية الصيدلة • مختبر علم الأدوية العملي
              </span>
            </div>
          </Link>

          {/* Desktop Center Badges */}
          <div className={styles.centerBadges}>
            <div className={styles.semesterPill}>
              <span className="animate-pulse-dot" />
              <span>العام الجامعي 2026/2027</span>
            </div>
            <span>6 مجموعات دراسية</span>
            <span>•</span>
            <span>8 فرق لكل مجموعة</span>
            <span>•</span>
            <span>توزيع تكافؤي فوري</span>
          </div>

          {/* Header Action Controls */}
          <div className={styles.headerActions}>
            <ThemeToggle />
            <Link
              href="/auth/login"
              className="btn btn-primary btn-sm"
            >
              <span>🔐</span>
              <span>تسجيل دخول المشرف</span>
            </Link>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className={styles.main}>
        <div className="container-xl">

          {/* Centered Hero Section */}
          <section className={styles.hero}>
            
            {/* Introductory Badge */}
            <div className={styles.heroBadge}>
              <span className="animate-pulse-dot" />
              <span>منظومة إلكترونية متكاملة لإدارة وتوزيع الطلاب مخبرياً</span>
            </div>

            {/* Main Title */}
            <h1 className={styles.heroTitle}>
              إدارة وتنظيم فرق طلاب
              <span className={styles.heroTitleHighlight}>
                تجارب الأرانب المخبرية
              </span>
            </h1>

            {/* Subtitle / Paragraph */}
            <p className={styles.heroDesc}>
              نظام أكاديمي متكامل يتيح لمشرفي مختبر علم الأدوية العملي تنظيم المجموعات الدراسية، تشكيل فرق التجارب، تعيين القادة،
              توليد روابط دعوة آمنة، التوزيع العشوائي التكافؤي، وتصدير النتائج فوراً إلى ملفات Excel معتمدة.
            </p>

            {/* Action Buttons */}
            <div className={styles.heroActions}>
              <Link
                href="/auth/login"
                className="btn btn-primary btn-lg"
              >
                <span>الدخول إلى لوحة التحكم الإدارية</span>
                <span>←</span>
              </Link>
              <Link
                href="/auth/login"
                className="btn btn-outline btn-lg"
              >
                <span>👑</span>
                <span>بوابة قادة الفرق والدعوات</span>
              </Link>
            </div>

            {/* Quick Academic Specs Strip */}
            <div className={styles.specsGrid}>
              <div className={styles.specItem}>
                <span>🎓</span>
                <span>6 مجموعات دراسية (A1 إلى C2)</span>
              </div>
              <div className={styles.specItem}>
                <span>🐇</span>
                <span>8 فرق وتجارب لكل مجموعة</span>
              </div>
              <div className={styles.specItem}>
                <span>🎲</span>
                <span>توزيع عشوائي متكافئ وعادل</span>
              </div>
              <div className={styles.specItem}>
                <span>📊</span>
                <span>تصدير Excel رسمي RTL</span>
              </div>
            </div>

          </section>

          {/* Feature Cards Section */}
          <section className={styles.featuresSection}>
            
            <div className={styles.featuresHeader}>
              <span className={styles.featuresSub}>
                المميزات الأكاديمية
              </span>
              <h2 className={styles.featuresTitle}>
                حلول متكاملة لإدارة المختبرات العملية
              </h2>
            </div>

            <div className={styles.featuresGrid}>

              {/* Card 1 */}
              <div className={styles.featureCard}>
                <div>
                  <div className={styles.cardTop}>
                    <div className={`${styles.cardIcon} ${styles.cardIconBlue}`}>
                      👑
                    </div>
                    <span className="status-badge status-badge-primary">
                      روابط مشفرة
                    </span>
                  </div>
                  <h3 className={styles.cardHeading}>
                    بوابات قادة الفرق المستقلة
                  </h3>
                  <p className={styles.cardDesc}>
                    روابط دخول آمنة ومخصصة لكل قائد فريق تمكنه من دعوة زملائه من نفس مجموعته الدراسية وإرسال الدعوات مباشرة عبر واتساب.
                  </p>
                </div>

                <ul className={styles.cardFeatures}>
                  <li className={styles.cardFeatureItem}>
                    <span className={styles.cardCheck}>✓</span>
                    <span>صلاحيات مخصصة لكل قائد فريق</span>
                  </li>
                  <li className={styles.cardFeatureItem}>
                    <span className={styles.cardCheck}>✓</span>
                    <span>إرسال فوري للروابط عبر واتساب</span>
                  </li>
                  <li className={styles.cardFeatureItem}>
                    <span className={styles.cardCheck}>✓</span>
                    <span>متابعة لحظية لاكتمال السعة والمقاعد</span>
                  </li>
                </ul>
              </div>

              {/* Card 2 */}
              <div className={styles.featureCard}>
                <div>
                  <div className={styles.cardTop}>
                    <div className={`${styles.cardIcon} ${styles.cardIconPurple}`}>
                      🎲
                    </div>
                    <span className="status-badge" style={{ backgroundColor: 'var(--purple-bg)', color: 'var(--purple-text)', border: '1px solid var(--purple-border)' }}>
                      خوارزمية ذكية
                    </span>
                  </div>
                  <h3 className={styles.cardHeading}>
                    توزيع عشوائي متكافئ وعادل
                  </h3>
                  <p className={styles.cardDesc}>
                    خوارزمية ذكية لتوزيع الطلاب المتبقين عشوائياً وتكافئياً على الفرق الشاغرة دون أي تحيز مع إمكانية المعاينة المسبقة والاعتماد الفوري.
                  </p>
                </div>

                <ul className={styles.cardFeatures}>
                  <li className={styles.cardFeatureItem}>
                    <span className={styles.cardCheck}>✓</span>
                    <span>موازنة تكافؤية تامة لأعداد الطلاب</span>
                  </li>
                  <li className={styles.cardFeatureItem}>
                    <span className={styles.cardCheck}>✓</span>
                    <span>معاينة ومحاكاة دقيقة قبل الحفظ</span>
                  </li>
                  <li className={styles.cardFeatureItem}>
                    <span className={styles.cardCheck}>✓</span>
                    <span>منع تداخل المجموعات الأكاديمية</span>
                  </li>
                </ul>
              </div>

              {/* Card 3 */}
              <div className={styles.featureCard}>
                <div>
                  <div className={styles.cardTop}>
                    <div className={`${styles.cardIcon} ${styles.cardIconGreen}`}>
                      📊
                    </div>
                    <span className="status-badge status-badge-success">
                      تنسيق RTL رسمي
                    </span>
                  </div>
                  <h3 className={styles.cardHeading}>
                    تصدير Excel فوري ومعتمد
                  </h3>
                  <p className={styles.cardDesc}>
                    تصدير جداول المجموعات والفرق بضغطة زر واحدة إلى مصنف Excel رسمي منسق بالكامل من اليمين لليسار مع تقسيم أوراق العمل لكل مجموعة.
                  </p>
                </div>

                <ul className={styles.cardFeatures}>
                  <li className={styles.cardFeatureItem}>
                    <span className={styles.cardCheck}>✓</span>
                    <span>مصنف موحد لكافة المجموعات الست</span>
                  </li>
                  <li className={styles.cardFeatureItem}>
                    <span className={styles.cardCheck}>✓</span>
                    <span>أوراق عمل منفصلة لكل مجموعة دراسية</span>
                  </li>
                  <li className={styles.cardFeatureItem}>
                    <span className={styles.cardCheck}>✓</span>
                    <span>جاهز للطباعة والاعتماد الأكاديمي</span>
                  </li>
                </ul>
              </div>

            </div>

          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={`container-xl ${styles.footerInner}`}>
          <p>نظام إدارة فرق تجارب الأرانب • كلية الصيدلة • مختبر علم الأدوية العملي</p>
          <p>العام الجامعي 2026/2027 • جميع الحقوق محفوظة</p>
        </div>
      </footer>

    </div>
  );
}
