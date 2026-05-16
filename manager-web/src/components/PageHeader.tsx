import Image from "next/image";
import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  nav?: ReactNode;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, nav, action }: PageHeaderProps) {
  return (
    <header
      style={{ backgroundColor: "var(--color-navbar-bg)" }}
      className="px-4 py-5 text-white shadow"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10">
              <Image
                src="/images/skibidi-logo.png"
                alt="SKIBIDI"
                fill
                className="object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-white/80">manager-web</p>
              <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">
                {title}
              </h1>
              <p className="mt-1 text-sm text-white/80 sm:text-base">
                {subtitle}
              </p>
            </div>
          </div>
          {action ? <div className="flex items-center">{action}</div> : null}
        </div>
        {nav ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">{nav}</div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
