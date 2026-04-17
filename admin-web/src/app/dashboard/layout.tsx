import { AdminSubNav } from "@/components/AdminSubNav";

export default function AdminDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <AdminSubNav />
      {children}
    </>
  );
}
