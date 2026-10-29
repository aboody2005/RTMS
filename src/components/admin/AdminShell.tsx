'use client';

import React, { useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import styles from './admin.module.css';

interface AdminShellProps {
  children: React.ReactNode;
  title?: string;
  adminName?: string;
}

export function AdminShell({ children, title, adminName }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={styles.layout}>
      
      {/* Sidebar Navigation */}
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Work Area */}
      <div className={styles.mainArea}>
        
        {/* Top Bar Header */}
        <header className={styles.topBar}>
          <div className={styles.topBarStart}>
            {/* Mobile menu toggle button */}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className={styles.menuToggleBtn}
              aria-label="فتح القائمة الجانبية"
            >
              ☰
            </button>

            {title && (
              <h2 className={styles.topBarTitle}>{title}</h2>
            )}
          </div>

          <div className={styles.topBarEnd}>
            {/* Theme Toggle Button */}
            <ThemeToggle />

            {/* Admin User Badge */}
            <div className={styles.adminBadge}>
              <div className={styles.adminAvatar}>
                م
              </div>
              <span>{adminName || 'المدير'}</span>
            </div>
          </div>
        </header>

        {/* Scrollable Page Content Area */}
        <main className={styles.contentArea}>
          <div className={styles.contentInner}>
            {children}
          </div>
        </main>

      </div>
    </div>
  );
}
