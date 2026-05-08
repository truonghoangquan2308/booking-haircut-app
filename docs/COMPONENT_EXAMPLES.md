"""
Design System Components - Reference & Examples
==============================================

This file provides ready-to-use component examples that implement the unified design system.
Copy these patterns to ensure consistency across the application.

"""

# ============================================
# 1. STAT CARD COMPONENT
# ============================================

## Example: Admin Dashboard Stats
```tsx
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  color?: "success" | "warning" | "danger" | "info" | "default";
  icon?: ReactNode;
  onClick?: () => void;
}

export function StatCard({ label, value, color = "default", icon, onClick }: StatCardProps) {
  const colorClass = {
    success: "border-l-4 border-[var(--color-success)]",
    warning: "border-l-4 border-[var(--color-warning)]",
    danger: "border-l-4 border-[var(--color-danger)]",
    info: "border-l-4 border-[var(--color-info)]",
    default: "",
  }[color];

  return (
    <button
      onClick={onClick}
      className={`stat-card cursor-pointer ${colorClass} transition-all hover:shadow-hover`}
    >
      <div className="flex w-full items-start justify-between">
        <div className="text-left">
          <div className="stat-value">{value}</div>
          <div className="stat-label">{label}</div>
        </div>
        {icon && <div className="text-2xl">{icon}</div>}
      </div>
    </button>
  );
}

## Usage:
<div className="stat-grid">
  <StatCard label="Total Users" value="1,234" color="info" onClick={handleClick} />
  <StatCard label="Revenue Today" value="₫5,200,000" color="success" />
  <StatCard label="Pending Orders" value="12" color="warning" />
</div>
```

# ============================================
# 2. BADGE COMPONENT
# ============================================

```tsx
interface BadgeProps {
  status: string;
  children: ReactNode;
  className?: string;
}

export function Badge({ status, children, className = "" }: BadgeProps) {
  const statusClass = {
    completed: "badge-success",
    available: "badge-success",
    "in-stock": "badge-success",
    confirmed: "badge-info",
    "in-progress": "badge-info",
    pending: "badge-warning",
    "on-leave": "badge-warning",
    low: "badge-warning",
    cancelled: "badge-danger",
    "off": "badge-danger",
    "out-of-stock": "badge-danger",
    default: "badge-gray",
  }[status] || "badge-gray";

  return <span className={`badge ${statusClass} ${className}`}>{children}</span>;
}

## Usage:
<Badge status="completed">Hoàn thành</Badge>
<Badge status="pending">Chờ xác nhận</Badge>
<Badge status="cancelled">Đã huỷ</Badge>
```

# ============================================
# 3. BUTTON COMPONENT
# ============================================

```tsx
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
    sm: "px-3 py-1 text-sm",
    md: "px-4 py-2",
    lg: "px-6 py-3 text-lg",
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

## Usage:
<Button variant="primary" onClick={handleSave}>Save Changes</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="danger" size="sm">Delete</Button>
```

# ============================================
# 4. CARD COMPONENT
# ============================================

```tsx
interface CardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Card({ title, description, children, footer, className = "" }: CardProps) {
  return (
    <div className={`card ${className}`}>
      {title && (
        <div className="mb-4">
          <h2 className="section-title">{title}</h2>
          {description && <p className="section-description">{description}</p>}
        </div>
      )}
      <div className="mb-4">{children}</div>
      {footer && <div className="border-t border-[var(--color-border)] pt-4">{footer}</div>}
    </div>
  );
}

## Usage:
<Card title="Edit Profile" description="Update your account information">
  <input type="text" placeholder="Full Name" />
  <input type="email" placeholder="Email" />
  <template #footer>
    <Button variant="primary">Save</Button>
    <Button variant="secondary">Cancel</Button>
  </template>
</Card>
```

# ============================================
# 5. TABLE COMPONENT
# ============================================

```tsx
interface TableProps {
  headers: string[];
  rows: (string | number | ReactNode)[][];
  onRowClick?: (rowIndex: number) => void;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
}

export function Table({
  headers,
  rows,
  onRowClick,
  loading = false,
  empty = false,
  emptyMessage = "No data available",
}: TableProps) {
  if (loading) {
    return <div className="card">Loading...</div>;
  }

  if (empty || rows.length === 0) {
    return (
      <div className="card text-center">
        <p className="text-[var(--color-text-muted)]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="table-container">
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

## Usage:
<Table
  headers={["Name", "Status", "Date"]}
  rows={[
    ["John Doe", <Badge status="completed">Done</Badge>, "2024-01-15"],
    ["Jane Smith", <Badge status="pending">Pending</Badge>, "2024-01-16"],
  ]}
  onRowClick={(idx) => handleEdit(idx)}
/>
```

# ============================================
# 6. TOAST NOTIFICATION
# ============================================

```tsx
import { useState, useCallback } from "react";

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

  return { toasts, show };
}

## Usage in Component:
const { toasts, show } = useToast();

const handleSave = async () => {
  try {
    await saveData();
    show("Saved successfully!", "success");
  } catch (error) {
    show("Failed to save", "error");
  }
};

// Render toasts
<div className="toast-container">
  {toasts.map((toast) => (
    <div key={toast.id} className={`toast toast-${toast.type}`}>
      {toast.message}
    </div>
  ))}
</div>
```

# ============================================
# 7. FORM SECTION
# ============================================

```tsx
interface FormSectionProps {
  title: string;
  description?: string;
  fields: {
    name: string;
    label: string;
    type?: string;
    required?: boolean;
    placeholder?: string;
    options?: { value: string; label: string }[];
  }[];
  onSubmit: (data: Record<string, string>) => Promise<void>;
}

export function FormSection({
  title,
  description,
  fields,
  onSubmit,
}: FormSectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const { show } = useToast();

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
    <Card title={title} description={description}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
              {field.label}
              {field.required && <span className="text-[var(--color-danger)]"> *</span>}
            </label>
            
            {field.type === "select" ? (
              <select
                value={values[field.name] || ""}
                onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
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
                value={values[field.name] || ""}
                onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                placeholder={field.placeholder}
                required={field.required}
                rows={4}
              />
            ) : (
              <input
                type={field.type || "text"}
                value={values[field.name] || ""}
                onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                placeholder={field.placeholder}
                required={field.required}
              />
            )}
          </div>
        ))}

        <div className="flex gap-2 pt-4">
          <Button variant="primary" type="submit" isLoading={isLoading}>
            Save
          </Button>
          <Button variant="secondary" type="button">
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
```

# ============================================
# 8. REFACTORING EXISTING COMPONENTS
# ============================================

## Before (Hardcoded):
```tsx
<div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
  <h2 className="text-lg font-bold text-gray-900">Total Appointments</h2>
  <p className="text-gray-500 text-sm">Today's statistics</p>
  <div className="text-3xl font-bold text-blue-600 mt-4">42</div>
</div>
```

## After (Design System):
```tsx
<div className="stat-card">
  <div className="section-title">Total Appointments</div>
  <div className="section-description">Today's statistics</div>
  <div className="stat-value" style={{ color: "var(--color-info)" }}>42</div>
</div>
```

## Before (Hardcoded buttons):
```tsx
<button className="px-4 py-2 bg-yellow-400 text-black rounded hover:brightness-95">
  Save
</button>
<button className="px-4 py-2 border border-gray-300 text-gray-900 rounded hover:bg-gray-100">
  Cancel
</button>
```

## After (Design System):
```tsx
<Button variant="primary">Save</Button>
<Button variant="secondary">Cancel</Button>
```

---
KEY POINTS:
✓ Always use CSS variables, not hardcoded colors
✓ Use component classes (.card, .stat-card, .badge, etc.)
✓ Keep styling in CSS, not inline styles
✓ Use utility buttons, badges, and cards
✓ Maintain consistent spacing (--spacing-section, --spacing-card)
✓ Use semantic HTML for accessibility
"""
