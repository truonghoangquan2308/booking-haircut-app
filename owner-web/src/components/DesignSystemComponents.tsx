"use client";

import React from "react";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";

interface StatCardProps {
  icon?: ReactNode;
  iconBg?: string;
  iconColor?: string;
  label: string;
  value: string | number;
  onClick?: () => void;
  href?: string;
}

export function StatCard({ icon, iconBg, iconColor, label, value, onClick, href }: StatCardProps) {
  const content = (
    <div className="stat-card-content">
      <div
        className="stat-card-icon"
        style={{
          background: iconBg ?? undefined,
          color: iconColor ?? undefined,
        }}
      >
        {icon}
      </div>
      <div className="stat-card-text">
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="stat-card">
        {content}
      </a>
    );
  }

  if (onClick) {
    return (
      <button type="button" className="stat-card text-left" onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className="stat-card">{content}</div>;
}

interface BadgeProps {
  status?: string;
  variant?: "success" | "warning" | "danger" | "info" | "gray";
  children?: ReactNode;
  className?: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  in_progress: "Đang thực hiện",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  available: "Hoàn thành",
  delivered: "Hoàn thành",
  shipping: "Đã xác nhận",
  off: "Đã hủy",
};

const VARIANT_FALLBACK: Record<NonNullable<BadgeProps["variant"]>, string> = {
  success: "Hoàn thành",
  warning: "Chờ xác nhận",
  danger: "Đã hủy",
  info: "Đã xác nhận",
  gray: "Không rõ",
};

export function Badge({ status, variant, children, className = "" }: BadgeProps) {
  const rawLabel =
    typeof children === "string"
      ? children
      : typeof status === "string"
        ? status
        : VARIANT_FALLBACK[variant ?? "gray"];
  const normalizedLabel = STATUS_LABELS[rawLabel] ?? rawLabel;

  return (
    <span className={className}>
      <StatusBadge status={normalizedLabel} />
    </span>
  );
}

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
    <div className={`card ${noPadding ? "p-0" : ""} ${className}`.trim()}>
      {title ? (
        <div className="mb-4">
          <h2 className="section-title">{title}</h2>
          {description ? <p className="section-description">{description}</p> : null}
        </div>
      ) : null}
      <div className={footer ? "mb-4" : ""}>{children}</div>
      {footer ? <div className="border-t border-[var(--color-border)] pt-4">{footer}</div> : null}
    </div>
  );
}

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
  const [page, setPage] = useState(1);
  const pageSize = rows.length > 100 ? 50 : rows.length;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  if (page > totalPages && totalPages > 0) setPage(totalPages);

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
  const start = (page - 1) * pageSize;
  const rowsToRender = rows.slice(start, start + pageSize);

  return (
    <div className={`table-container ${className}`.trim()}>
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowsToRender.map((row, idx) => (
            <tr
              key={start + idx}
              onClick={() => onRowClick?.(start + idx)}
              className={onRowClick ? "cursor-pointer" : ""}
            >
              {row.map((cell, cidx) => (
                <td key={cidx}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button className="btn" onClick={() => setPage(Math.max(1, page - 1))}>
            Prev
          </button>
          <div className="text-sm text-[var(--color-text-secondary)]">Page {page} / {totalPages}</div>
          <button className="btn" onClick={() => setPage(Math.min(totalPages, page + 1))}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}

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
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3000);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return { toasts, show, remove };
}

export function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: string) => void;
}) {
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
      show(error instanceof Error ? error.message : "Failed to save", "error");
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
                {field.required ? <span className="text-[var(--color-danger)]"> *</span> : null}
              </label>

              {field.type === "select" ? (
                <select
                  value={values[field.name] ?? field.value ?? ""}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setValues((prev) => ({ ...prev, [field.name]: nextValue }));
                    field.onChange?.(nextValue);
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
                    const nextValue = e.target.value;
                    setValues((prev) => ({ ...prev, [field.name]: nextValue }));
                    field.onChange?.(nextValue);
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
                    const nextValue = e.target.value;
                    setValues((prev) => ({ ...prev, [field.name]: nextValue }));
                    field.onChange?.(nextValue);
                  }}
                  placeholder={field.placeholder}
                  required={field.required}
                />
              )}
            </div>
          ))}

          <div className="flex gap-2 pt-4">
            <Button variant="primary" type="submit" isLoading={isLoading || loading}>
              {submitLabel}
            </Button>
            {onCancel ? (
              <Button variant="secondary" type="button" onClick={onCancel}>
                {cancelLabel}
              </Button>
            ) : null}
          </div>
        </form>
      </Card>
      <ToastContainer toasts={toasts} onRemove={remove} />
    </>
  );
}

export { Button };
