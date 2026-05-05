import { AuthGuard } from "@/components/AuthGuard";

export default function ReceptionistDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AuthGuard>{children}</AuthGuard>;
}
