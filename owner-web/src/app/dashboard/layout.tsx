import { OwnerSubNav } from "@/components/OwnerSubNav";
import { AuthGuard } from "@/components/AuthGuard";

export default function OwnerDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard>
      <OwnerSubNav />
      {children}
    </AuthGuard>
  );
}
