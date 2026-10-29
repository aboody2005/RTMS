'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'start' | 'end';
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'start',
  className,
  disabled,
  ...props
}: ButtonProps) {
  const variantClass = `btn-${variant}`;
  const sizeClass = `btn-${size}`;

  return (
    <button
      className={cn('btn', variantClass, sizeClass, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span
          style={{
            display: 'inline-block',
            width: '16px',
            height: '16px',
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }}
        />
      ) : icon && iconPosition === 'start' ? (
        <span>{icon}</span>
      ) : null}
      <span>{children}</span>
      {!loading && icon && iconPosition === 'end' ? (
        <span>{icon}</span>
      ) : null}
    </button>
  );
}
