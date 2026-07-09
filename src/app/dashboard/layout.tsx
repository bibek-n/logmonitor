import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import SidebarShell from "@/components/SidebarShell";
import LogoutButton from "@/components/LogoutButton";
import Header from "@/components/Header";
import IdleLogout from "@/components/IdleLogout";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="dash-shell">
      <IdleLogout />
      <SidebarShell>
        <div className="dash-user">
          <div className="name">
            {session.user?.name}
            <div className="role">{(session.user as { role?: string })?.role ?? "User"}</div>
          </div>
          <LogoutButton />
        </div>
      </SidebarShell>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Header userName={session.user?.name ?? "User"} />
        <main className="dash-content">{children}</main>
      </div>
    </div>
  );
}
