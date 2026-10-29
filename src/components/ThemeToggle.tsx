'use client';

import React, { useEffect, useState } from 'react';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('rabbit_theme') as 'light' | 'dark' | null;
    if (saved === 'dark' || saved === 'light') {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initial = prefersDark ? 'dark' : 'light';
      setTheme(initial);
      document.documentElement.setAttribute('data-theme', initial);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('rabbit_theme', next);
  };

  if (!mounted) {
    return (
      <button
        type="button"
        className={`theme-toggle-btn ${className}`}
        aria-label="تبديل المظهر"
        title="تبديل المظهر"
      >
        <span className="theme-toggle-icon">🌓</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn ${className}`}
      aria-label={theme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
      title={theme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
    >
      <span className="theme-toggle-icon">
        {theme === 'dark' ? '☀️' : '🌙'}
      </span>
      <span className="theme-toggle-label">
        {theme === 'dark' ? 'نهاري' : 'ليلي'}
      </span>
    </button>
  );
}
