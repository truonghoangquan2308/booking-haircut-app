import { AuthGuard } from "@/components/AuthGuard";

export default function ManagerDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AuthGuard>{children}</AuthGuard>;
}
