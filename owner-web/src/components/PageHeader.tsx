"use client";

import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: Props) {
  return (
    <header
      className={`border-b border-white/10 bg-bb-navy px-6 py-4 text-white shadow-sm ${className ?? ""}`}
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="mt-2 text-sm text-white/80">{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 lg:mt-0">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
