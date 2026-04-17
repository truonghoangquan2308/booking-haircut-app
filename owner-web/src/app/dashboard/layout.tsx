import { OwnerSubNav } from "@/components/OwnerSubNav";

export default function OwnerDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <OwnerSubNav />
      {children}
    </>
  );
}
