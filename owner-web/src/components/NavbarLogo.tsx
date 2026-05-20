import Image from "next/image";

const ROLE_CONFIG = {
  owner: { label: "OWNER", color: "var(--role-owner)" },
  manager: { label: "MANAGER", color: "var(--role-manager)" },
  receptionist: { label: "RECEPTIONIST", color: "var(--role-receptionist)" },
  admin: { label: "ADMIN", color: "var(--role-admin)" },
} as const;

type RoleKey = keyof typeof ROLE_CONFIG;

export function NavbarLogo({ role }: { role: RoleKey }) {
  const { label, color } = ROLE_CONFIG[role] ?? ROLE_CONFIG.owner;

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full border-2 bg-black"
        style={{ borderColor: color }}
      >
        <Image
          src="/skibidi-logo.png"
          alt="SKIBIDI Barber"
          width={36}
          height={36}
          className="rounded-full object-cover"
        />
      </div>

      <div className="flex flex-col leading-none">
        <span className="text-sm font-bold tracking-[0.18em] text-white">
          SKIBIDI
        </span>
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.28em]"
          style={{ color }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
