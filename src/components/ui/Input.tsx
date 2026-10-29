'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, hint, icon, className, id, ...props }: InputProps) {
  const inputId = id || label?.replace(/\s+/g, '-').toLowerCase();

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
          {props.required && <span style={{ color: 'var(--danger-solid)', marginInlineStart: '4px' }}>*</span>}
        </label>
      )}
      <div style={{ position: 'relative', width: '100%' }}>
        {icon && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              insetInlineStart: '10px',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {icon}
          </div>
        )}
        <input
          id={inputId}
          className={cn('form-input', error && 'form-input-error', className)}
          style={{
            paddingInlineStart: icon ? '36px' : undefined,
          }}
          {...props}
        />
      </div>
      {error && (
        <p className="form-error-msg">
          <span>✕</span>
          <span>{error}</span>
        </p>
      )}
      {hint && !error && <p className="form-hint">{hint}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ label, error, hint, options, placeholder, className, id, ...props }: SelectProps) {
  const selectId = id || label?.replace(/\s+/g, '-').toLowerCase();

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={selectId} className="form-label">
          {label}
          {props.required && <span style={{ color: 'var(--danger-solid)', marginInlineStart: '4px' }}>*</span>}
        </label>
      )}
      <select
        id={selectId}
        className={cn('form-select', error && 'form-input-error', className)}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="form-error-msg">
          <span>✕</span>
          <span>{error}</span>
        </p>
      )}
      {hint && !error && <p className="form-hint">{hint}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, className, id, ...props }: TextareaProps) {
  const textareaId = id || label?.replace(/\s+/g, '-').toLowerCase();

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={textareaId} className="form-label">
          {label}
          {props.required && <span style={{ color: 'var(--danger-solid)', marginInlineStart: '4px' }}>*</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        className={cn('form-textarea', error && 'form-input-error', className)}
        style={{ minHeight: '100px', resize: 'vertical' }}
        {...props}
      />
      {error && (
        <p className="form-error-msg">
          <span>✕</span>
          <span>{error}</span>
        </p>
      )}
      {hint && !error && <p className="form-hint">{hint}</p>}
    </div>
  );
}
