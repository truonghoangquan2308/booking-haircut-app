"use client";

import type { ReactNode } from "react";
import { useState, useCallback } from "react";

/* ============================================
   STAT CARD COMPONENT
   ============================================ */

interface StatCardProps {
  label: string;
  value: string | number;
  color?: "success" | "warning" | "danger" | "info" | "default";
  icon?: ReactNode;
  onClick?: () => void;
  href?: string;
}

export function StatCard({
  label,
  value,
  color = "default",
  icon,
  onClick,
  href,
}: StatCardProps) {
  const colorBorder = {
    success: "border-l-4 border-[var(--color-success)]",
    warning: "border-l-4 border-[var(--color-warning)]",
    danger: "border-l-4 border-[var(--color-danger)]",
    info: "border-l-4 border-[var(--color-info)]",
    default: "",
  }[color];

  const className = `stat-card ${colorBorder} transition-all cursor-pointer`;

  const content = (
    <div className="flex w-full items-start justify-between">
      <div className="text-left">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
      {icon && <div className="text-2xl">{icon}</div>}
    </div>
  );

  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }

  return (
    <button
      onClick={onClick}
      className={className}
      type="button"
    >
      {content}
    </button>
  );
}

/* ============================================
   BADGE COMPONENT
   ============================================ */

interface BadgeProps {
  status?: string;
  variant?: "success" | "warning" | "danger" | "info" | "gray";
  children: ReactNode;
  className?: string;
}

export function Badge({
  status,
  variant,
  children,
  className = "",
}: BadgeProps) {
  let badgeClass = "badge ";

  if (variant) {
    badgeClass += `badge-${variant}`;
  } else if (status) {
    const statusMap: Record<string, string> = {
      completed: "badge-success",
      available: "badge-success",
      "in-stock": "badge-success",
      confirmed: "badge-info",
      "in-progress": "badge-info",
      pending: "badge-warning",
      "on-leave": "badge-warning",
      low: "badge-warning",
      cancelled: "badge-danger",
      off: "badge-danger",
      "out-of-stock": "badge-danger",
      delivered: "badge-success",
      shipping: "badge-info",
    };
    badgeClass += statusMap[status] || "badge-gray";
  } else {
    badgeClass += "badge-gray";
  }

  return <span className={`${badgeClass} ${className}`}>{children}</span>;
}

/* ============================================
   BUTTON COMPONENT
   ============================================ */

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const variantClass = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    danger: "btn-danger",
  }[variant];

  const sizeClass = {
    sm: "text-xs px-2 py-1",
    md: "",
    lg: "text-lg px-6 py-3",
  }[size];

  return (
    <button
      className={`btn ${variantClass} ${sizeClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? "Đang xử lý..." : children}
    </button>
  );
}

/* ============================================
   CARD COMPONENT
   ============================================ */

interface CardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Card({
  title,
  description,
  children,
  footer,
  className = "",
  noPadding = false,
}: CardProps) {
  return (
    <div className={`card ${!noPadding ? "" : "p-0"} ${className}`}>
      {title && (
        <div className="mb-4">
          <h2 className="section-title">{title}</h2>
          {description && <p className="section-description">{description}</p>}
        </div>
      )}
      <div className={title && !footer ? "" : "mb-4"}>{children}</div>
      {footer && (
        <div className="border-t border-[var(--color-border)] pt-4">{footer}</div>
      )}
    </div>
  );
}

/* ============================================
   TABLE COMPONENT
   ============================================ */

interface TableProps {
  headers: string[];
  rows: (string | number | ReactNode)[][];
  onRowClick?: (rowIndex: number) => void;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function Table({
  headers,
  rows,
  onRowClick,
  loading = false,
  empty = false,
  emptyMessage = "No data available",
  className = "",
}: TableProps) {
  if (loading) {
    return (
      <div className="card">
        <p className="text-center text-[var(--color-text-muted)]">Loading...</p>
      </div>
    );
  }

  if (empty || rows.length === 0) {
    return (
      <div className="card text-center">
        <p className="text-[var(--color-text-muted)]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`table-container ${className}`}>
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={idx}
              onClick={() => onRowClick?.(idx)}
              className={onRowClick ? "cursor-pointer" : ""}
            >
              {row.map((cell, cidx) => (
                <td key={cidx}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================
   TOAST HOOK & COMPONENT
   ============================================ */

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now().toString();
    const toast: Toast = { id, message, type };

    setToasts((prev) => [...prev, toast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, show, remove };
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
          onClick={() => onRemove(toast.id)}
          role="alert"
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}

/* ============================================
   FORM SECTION COMPONENT
   ============================================ */

interface FormField {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  value?: string | number;
  options?: { value: string; label: string }[];
  onChange?: (value: string) => void;
}

interface FormSectionProps {
  title: string;
  description?: string;
  fields: FormField[];
  onSubmit: (data: Record<string, string>) => Promise<void>;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  loading?: boolean;
}

export function FormSection({
  title,
  description,
  fields,
  onSubmit,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  onCancel,
  loading = false,
}: FormSectionProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { toasts, show, remove } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSubmit(values);
      show("Saved successfully!", "success");
    } catch (error) {
      show(
        error instanceof Error ? error.message : "Failed to save",
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Card title={title} description={description}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((field) => (
            <div key={field.name}>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
                {field.label}
                {field.required && (
                  <span className="text-[var(--color-danger)]"> *</span>
                )}
              </label>

              {field.type === "select" ? (
                <select
                  value={values[field.name] ?? field.value ?? ""}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setValues((prev) => ({ ...prev, [field.name]: newValue }));
                    field.onChange?.(newValue);
                  }}
                  required={field.required}
                >
                  <option value="">-- Select --</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  value={values[field.name] ?? field.value ?? ""}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setValues((prev) => ({ ...prev, [field.name]: newValue }));
                    field.onChange?.(newValue);
                  }}
                  placeholder={field.placeholder}
                  required={field.required}
                  rows={4}
                />
              ) : (
                <input
                  type={field.type || "text"}
                  value={values[field.name] ?? field.value ?? ""}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setValues((prev) => ({ ...prev, [field.name]: newValue }));
                    field.onChange?.(newValue);
                  }}
                  placeholder={field.placeholder}
                  required={field.required}
                />
              )}
            </div>
          ))}

          <div className="flex gap-2 pt-4">
            <Button
              variant="primary"
              type="submit"
              isLoading={isLoading || loading}
            >
              {submitLabel}
            </Button>
            {onCancel && (
              <Button variant="secondary" type="button" onClick={onCancel}>
                {cancelLabel}
              </Button>
            )}
          </div>
        </form>
      </Card>
      <ToastContainer toasts={toasts} onRemove={remove} />
    </>
  );
}
