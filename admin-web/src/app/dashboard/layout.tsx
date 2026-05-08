import { AdminSubNav } from "@/components/AdminSubNav";
import { AuthGuard } from "@/components/AuthGuard";

export default function AdminDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard>
      <AdminSubNav />
      {children}
    </AuthGuard>
  );
}
