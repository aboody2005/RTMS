'use client';

import React from 'react';
import {
  cn,
  getMembershipStatusColor,
  getMembershipStatusLabel,
  getInvitationStatusColor,
  getInvitationStatusLabel,
  rebaseAppUrl,
  copyToClipboard,
} from '@/lib/utils';

export * from './Button';
export * from './Input';

// =====================================================
// Card Component
// =====================================================

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  style?: React.CSSProperties;
}

export function Card({ children, className, padding = 'md', hover = false, style }: CardProps) {
  const paddingClass = `card-p-${padding}`;
  return (
    <div className={cn('card', paddingClass, hover && 'card-hover', className)} style={style}>
      {children}
    </div>
  );
}

// =====================================================
// Stats Card
// =====================================================

interface StatsCardProps {
  title: string;
  value: number | string;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo';
  subtitle?: string;
  trend?: { value: number; positive: boolean };
}

export function StatsCard({ title, value, icon, color = 'blue', subtitle, trend }: StatsCardProps) {
  const colorMap = {
    blue: { bg: 'var(--primary-light)', text: 'var(--primary-text)' },
    green: { bg: 'var(--success-bg)', text: 'var(--success-text)' },
    yellow: { bg: 'var(--warning-bg)', text: 'var(--warning-text)' },
    red: { bg: 'var(--danger-bg)', text: 'var(--danger-text)' },
    purple: { bg: 'var(--purple-bg)', text: 'var(--purple-text)' },
    indigo: { bg: 'var(--primary-light)', text: 'var(--primary-text)' },
  };

  const selectedColor = colorMap[color] || colorMap.blue;

  return (
    <div className="stats-card">
      <div className="stats-card-info">
        <p className="stats-card-title">{title}</p>
        <p className="stats-card-value">{typeof value === 'number' ? value.toLocaleString('ar-SA') : value}</p>
        {subtitle && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{subtitle}</p>}
        {trend && (
          <p
            style={{
              fontSize: '0.75rem',
              marginTop: '8px',
              fontWeight: 600,
              color: trend.positive ? 'var(--success-text)' : 'var(--danger-text)',
            }}
          >
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </p>
        )}
      </div>
      {icon && (
        <div
          className="stats-card-icon"
          style={{
            backgroundColor: selectedColor.bg,
            color: selectedColor.text,
          }}
        >
          {icon}
        </div>
      )}
    </div>
  );
}

// =====================================================
// Status Badge
// =====================================================

interface BadgeProps {
  status: string;
  type?: 'membership' | 'invitation' | 'custom';
  label?: string;
  color?: string;
}

export function Badge({ status, type = 'membership', label, color }: BadgeProps) {
  let displayLabel = label;
  let colorClass = color;

  if (!displayLabel) {
    displayLabel = type === 'membership' ? getMembershipStatusLabel(status) : getInvitationStatusLabel(status);
  }
  if (!colorClass) {
    colorClass = type === 'membership' ? getMembershipStatusColor(status) : getInvitationStatusColor(status);
  }

  return (
    <span className={cn('status-badge', colorClass)}>
      {displayLabel}
    </span>
  );
}

// =====================================================
// Modal / Dialog
// =====================================================

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, size = 'md', footer }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={cn('modal-dialog', size === 'lg' || size === 'xl' ? 'modal-dialog-lg' : '')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button onClick={onClose} className="modal-close-btn" aria-label="إغلاق">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">{children}</div>

        {/* Footer */}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// =====================================================
// Confirmation Dialog
// =====================================================

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info' | 'primary';
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const handleClose = () => {
    if (onCancel) onCancel();
    else if (onClose) onClose();
  };

  const variantBtn =
    variant === 'danger'
      ? 'btn-danger'
      : variant === 'warning'
      ? 'btn-primary'
      : 'btn-primary';

  const icons = {
    danger: '🗑️',
    warning: '⚠️',
    info: 'ℹ️',
    primary: '✨',
  };

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div
        className="modal-dialog"
        style={{ maxWidth: '440px', textAlign: 'center', padding: 'var(--space-6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-2)' }}>{icons[variant]}</div>
        <h3 className="modal-title" style={{ marginBottom: 'var(--space-2)' }}>{title}</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={handleClose}
            className="btn btn-secondary"
            style={{ flex: 1 }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn('btn', variantBtn)}
            style={{ flex: 1 }}
          >
            {loading ? 'جاري التنفيذ...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Empty State
// =====================================================

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = '📭', title, description, action, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-12) var(--space-4)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '3rem', marginBottom: 'var(--space-3)' }}>{icon}</div>
      <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
        {title}
      </h3>
      {description && (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '400px', marginBottom: 'var(--space-5)' }}>
          {description}
        </p>
      )}
      {action ? (
        action
      ) : actionLabel && onAction ? (
        <button type="button" onClick={onAction} className="btn btn-primary btn-sm">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

// =====================================================
// Loading Skeleton
// =====================================================

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height: '44px',
            backgroundColor: 'var(--bg-surface-secondary)',
            borderRadius: 'var(--radius-md)',
            animation: 'pulse 1.5s infinite',
          }}
        />
      ))}
    </div>
  );
}

// =====================================================
// Page Header
// =====================================================

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumb?: { label: string; href?: string }[];
}

export function PageHeader({ title, subtitle, actions, breadcrumb }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: '0.8125rem',
            color: 'var(--text-muted)',
            marginBottom: 'var(--space-2)',
          }}
        >
          {breadcrumb.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span>/</span>}
              {item.href ? (
                <a href={item.href} style={{ color: 'var(--primary)', fontWeight: 500 }}>
                  {item.label}
                </a>
              ) : (
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{item.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{title}</h1>
          {subtitle && (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '4px' }}>{subtitle}</p>
          )}
        </div>
        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================
// Alert / Notification
// =====================================================

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  onClose?: () => void;
}

export function Alert({ type, title, message, onClose }: AlertProps) {
  const alertClass = `alert-${type}`;
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div className={cn('alert', alertClass)}>
      <span style={{ fontWeight: 800, fontSize: '1rem', flexShrink: 0 }}>{icons[type]}</span>
      <div style={{ flex: 1 }}>
        {title && <p style={{ fontWeight: 700, marginBottom: '2px' }}>{title}</p>}
        <p style={{ margin: 0 }}>{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          style={{ opacity: 0.7, padding: '2px 6px', fontSize: '0.85rem' }}
          aria-label="إغلاق التنبيه"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// =====================================================
// Copy Link Button
// =====================================================

interface CopyLinkButtonProps {
  url: string;
  label?: string;
}

export function CopyLinkButton({ url, label = 'نسخ الرابط' }: CopyLinkButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    const fullUrl = rebaseAppUrl(url);
    const ok = await copyToClipboard(fullUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn('btn btn-sm', copied ? 'btn-success' : 'btn-secondary')}
    >
      <span>{copied ? '✓' : '📋'}</span>
      <span>{copied ? 'تم النسخ' : label}</span>
    </button>
  );
}

// =====================================================
// Capacity Bar
// =====================================================

interface CapacityBarProps {
  confirmed: number;
  max: number;
  pending?: number;
  showLabels?: boolean;
}

export function CapacityBar({ confirmed, max, pending = 0, showLabels = true }: CapacityBarProps) {
  const safeMax = Math.max(1, max);
  const confirmedPct = Math.min((confirmed / safeMax) * 100, 100);
  const pendingPct = Math.min(((confirmed + pending) / safeMax) * 100, 100) - confirmedPct;

  return (
    <div className="capacity-bar-container">
      {showLabels && (
        <div className="capacity-bar-meta">
          <span>{confirmed} مؤكد{pending > 0 ? ` + ${pending} معلق` : ''}</span>
          <span>{max} كحد أقصى</span>
        </div>
      )}
      <div className="capacity-bar-track">
        <div className="capacity-bar-fill-confirmed" style={{ width: `${confirmedPct}%` }} />
        {pending > 0 && (
          <div className="capacity-bar-fill-pending" style={{ width: `${pendingPct}%` }} />
        )}
      </div>
    </div>
  );
}

// =====================================================
// Table Wrapper, Th, Td
// =====================================================

export function TableWrapper({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('table-wrapper', className)}>
      <table className="table">{children}</table>
    </div>
  );
}

export function Th({ children, className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={className} {...props}>
      {children}
    </th>
  );
}

export function Td({ children, className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={className} {...props}>
      {children}
    </td>
  );
}

// Re-export Toast
export { ToastProvider, useToast } from './Toast';
export type { ToastType, ToastMessage } from './Toast';
