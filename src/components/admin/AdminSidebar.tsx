'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './admin.module.css';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const navItems: NavGroup[] = [
  {
    group: 'الرئيسية',
    items: [
      { href: '/admin', label: 'لوحة التحكم', icon: '🏠', exact: true },
    ],
  },
  {
    group: 'إدارة البيانات',
    items: [
      { href: '/admin/groups', label: 'المجموعات الدراسية', icon: '🎓' },
      { href: '/admin/students', label: 'إدارة الطلبة', icon: '👨‍🎓' },
      { href: '/admin/import', label: 'استيراد الطلبة', icon: '📥' },
    ],
  },
  {
    group: 'إدارة الفرق',
    items: [
      { href: '/admin/teams', label: 'إدارة الفرق', icon: '🐇' },
      { href: '/admin/leaders', label: 'قادة الفرق', icon: '👑' },
      { href: '/admin/assignments', label: 'إدارة التوزيع', icon: '📋' },
      { href: '/admin/distribution', label: 'التوزيع العشوائي', icon: '🎲' },
    ],
  },
  {
    group: 'المتابعة والتقارير',
    items: [
      { href: '/admin/invitations', label: 'الدعوات والتأكيدات', icon: '✉️' },
      { href: '/admin/export', label: 'تصدير Excel', icon: '📊' },
      { href: '/admin/audit', label: 'سجل العمليات', icon: '📜' },
    ],
  },
  {
    group: 'النظام',
    items: [
      { href: '/admin/settings', label: 'الإعدادات', icon: '⚙️' },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminSidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpen && (
        <div
          className={styles.drawerBackdrop}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Aside */}
      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
        
        {/* Brand Header */}
        <div className={styles.sidebarHeader}>
          <Link href="/admin" className={styles.sidebarBrand} onClick={onClose}>
            <div className={styles.sidebarLogo}>
              🐇
            </div>
            <div>
              <h2 className={styles.sidebarTitle}>إدارة فرق الأرانب</h2>
              <p className={styles.sidebarSubtitle}>مختبر علم الأدوية العملي</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className={styles.sidebarCloseBtn}
            aria-label="إغلاق القائمة"
          >
            ✕
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className={styles.sidebarNav}>
          {navItems.map((group) => (
            <div key={group.group} className={styles.navGroup}>
              <p className={styles.navGroupTitle}>{group.group}</p>
              <div>
                {group.items.map((item) => {
                  const active = isActive(item.href, item.exact);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                    >
                      <span className={styles.navItemIcon}>{item.icon}</span>
                      <span>{item.label}</span>
                      {active && <span className={styles.navItemIndicator} />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer / Logout */}
        <div className={styles.sidebarFooter}>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className={styles.logoutBtn}>
              <span className={styles.navItemIcon}>🚪</span>
              <span>تسجيل الخروج</span>
            </button>
          </form>
        </div>

      </aside>
    </>
  );
}
