import AdminSidebar from "@/components/admin/Sidebar";
import AdminHeader from "@/components/admin/Header";

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <AdminHeader />
        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
