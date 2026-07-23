import {
  Activity,
  ArrowLeft,
  BookOpenCheck,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useAppSelector } from "../app/store";
import { AppLogo } from "../components/common/app-logo";
import { Button } from "../components/ui/button";
import { useLogout } from "../features/auth/hooks/use-logout";
import { selectCurrentUser } from "../features/auth/store/auth.slice";

const links: ReadonlyArray<{ icon: LucideIcon; label: string; to: string }> = [
  { icon: LayoutDashboard, label: "Overview", to: "/admin" },
  { icon: Users, label: "Users", to: "/admin/users" },
  { icon: Activity, label: "Job monitoring", to: "/admin/jobs" },
  { icon: ClipboardList, label: "Audit logs", to: "/admin/audit-logs" },
  { icon: BookOpenCheck, label: "Sources", to: "/admin/sources" },
];

function AdminNavigation({ close }: { close?: () => void }) {
  return (
    <nav aria-label="Admin navigation" className="space-y-1 px-3">
      {links.map(({ icon: Icon, label, to }) => (
        <NavLink
          className={({ isActive }) =>
            `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold ${
              isActive
                ? "bg-violet-100 text-violet-950"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`
          }
          end={to === "/admin"}
          key={to}
          onClick={close}
          to={to}
        >
          <Icon aria-hidden="true" className="size-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const user = useAppSelector(selectCurrentUser);
  const logout = useLogout();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: (_data, error) => {
        navigate("/login", { replace: true });
        toast[error ? "warning" : "success"](
          error
            ? "Local session cleared; server revocation could not be confirmed."
            : "Logged out successfully.",
        );
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {open ? (
        <button
          aria-label="Close admin navigation"
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          onClick={() => setOpen(false)}
          type="button"
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-violet-200 bg-white transition-transform lg:w-64 ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-slate-100 px-5">
          <AppLogo />
          <Button
            aria-label="Close menu"
            className="lg:hidden"
            onClick={() => setOpen(false)}
            size="icon"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-5" />
          </Button>
        </div>
        <div className="mx-4 my-4 flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-900">
          <ShieldCheck aria-hidden="true" className="size-5" />
          Administration area
        </div>
        <AdminNavigation close={() => setOpen(false)} />
        <div className="mt-auto border-t border-slate-100 p-4">
          <NavLink
            className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            to="/dashboard"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            User dashboard
          </NavLink>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              aria-label="Open admin navigation"
              className="lg:hidden"
              onClick={() => setOpen(true)}
              size="icon"
              variant="ghost"
            >
              <Menu aria-hidden="true" className="size-5" />
            </Button>
            <div>
              <p className="text-sm font-semibold text-slate-950">
                {user?.fullName ?? "Administrator"}
              </p>
              <p className="text-xs text-violet-700">
                {user?.role.replace("_", " ") ?? "ADMIN"}
              </p>
            </div>
          </div>
          <Button
            isLoading={logout.isPending}
            onClick={handleLogout}
            size="sm"
            variant="outline"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Log out
          </Button>
        </header>
        <main className="mx-auto w-full max-w-[90rem] px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
