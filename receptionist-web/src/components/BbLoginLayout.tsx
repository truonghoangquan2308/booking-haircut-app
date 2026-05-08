import type { ReactNode } from "react";

export function BbLoginLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-y-auto bg-bb-yellow">
      <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col justify-center px-4 py-8 sm:px-5 sm:py-10">
        <header className="shrink-0">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 text-amber-700"
                fill="currentColor"
                aria-hidden
              >
                <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-bold text-black/87">GROUP 5</p>
              <p className="text-sm text-black/75">Haircut Booking App</p>
            </div>
          </div>
          <div className="mt-3 rounded-full bg-bb-navy px-4 py-2.5 text-center shadow-md">
            <p className="text-base font-bold text-white">{title}</p>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-white/80">{subtitle}</p>
            ) : null}
          </div>
        </header>

        <div className="mt-5 w-full rounded-[20px] bg-white p-6 shadow-[0_6px_12px_rgba(0,0,0,0.05)] sm:mt-6">
          {children}
        </div>
      </div>
    </div>
  );
}
