import {
  BriefcaseBusiness,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useAppSelector } from "../app/store";
import { AppLogo } from "../components/common/app-logo";
import { Button } from "../components/ui/button";
import { useLogout } from "../features/auth/hooks/use-logout";
import { selectCurrentUser } from "../features/auth/store/auth.slice";

type NavigationItem = {
  icon: LucideIcon;
  label: string;
  to: string;
};

const navigationItems: readonly NavigationItem[] = [
  { icon: LayoutDashboard, label: "Overview", to: "/dashboard" },
  { icon: BriefcaseBusiness, label: "Jobs", to: "/dashboard/jobs" },
  { icon: UsersRound, label: "Leads", to: "/dashboard/leads" },
  { icon: Settings, label: "Settings", to: "/dashboard/settings" },
];

function DashboardNavigation({
  onNavigate,
  showAdmin = false,
}: {
  onNavigate?: () => void;
  showAdmin?: boolean;
}) {
  const items = showAdmin
    ? [
        ...navigationItems,
        { icon: ShieldCheck, label: "Administration", to: "/admin" },
      ]
    : navigationItems;
  return (
    <nav aria-label="Dashboard navigation" className="space-y-1 px-3">
      {items.map(({ icon: Icon, label, to }) => (
        <NavLink
          className={({ isActive }) =>
            [
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
              isActive
                ? "bg-brand-50 text-brand-800"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
            ].join(" ")
          }
          end={to === "/dashboard"}
          key={to}
          onClick={onNavigate}
          to={to}
        >
          <Icon aria-hidden="true" className="size-5 shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function getInitials(fullName: string): string {
  const initials = fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "U";
}

export function DashboardLayout() {
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);
  const closeNavigationButtonRef = useRef<HTMLButtonElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const user = useAppSelector(selectCurrentUser);
  const logoutMutation = useLogout();

  const displayName = user?.fullName ?? "Account";
  const displayRole = user?.role.replace("_", " ") ?? "USER";

  const closeMobileNavigation = useCallback(() => {
    setIsMobileNavigationOpen(false);
    window.requestAnimationFrame(() => menuTriggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!isMobileNavigationOpen) {
      return;
    }

    closeNavigationButtonRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileNavigation();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [closeMobileNavigation, isMobileNavigationOpen]);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: (_data, error) => {
        navigate("/login", { replace: true });
        if (error) {
          toast.warning(
            "Local access was cleared, but server session revocation could not be confirmed.",
          );
          return;
        }
        toast.success("Logged out successfully.");
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {isMobileNavigationOpen ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-[1px] lg:hidden"
          onClick={closeMobileNavigation}
          type="button"
        />
      ) : null}

      <aside
        aria-hidden={!isMobileNavigationOpen}
        aria-label="Mobile dashboard sidebar"
        className={[
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white shadow-xl transition-transform lg:hidden",
          isMobileNavigationOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        id="mobile-dashboard-navigation"
        inert={!isMobileNavigationOpen}
      >
        <div className="flex h-20 items-center justify-between border-b border-slate-100 px-5">
          <AppLogo />
          <Button
            aria-label="Close navigation menu"
            onClick={closeMobileNavigation}
            ref={closeNavigationButtonRef}
            size="icon"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto py-5">
          <DashboardNavigation
            onNavigate={closeMobileNavigation}
            showAdmin={user?.role === "ADMIN" || user?.role === "SUPER_ADMIN"}
          />
        </div>
      </aside>

      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-20 items-center border-b border-slate-100 px-6">
          <AppLogo />
        </div>
        <div className="flex-1 overflow-y-auto py-5">
          <DashboardNavigation
            showAdmin={user?.role === "ADMIN" || user?.role === "SUPER_ADMIN"}
          />
        </div>
        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800"
            >
              {getInitials(displayName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {displayName}
              </p>
              <p className="truncate text-xs font-medium text-slate-500">
                {displayRole}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64" inert={isMobileNavigationOpen}>
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              aria-controls="mobile-dashboard-navigation"
              aria-expanded={isMobileNavigationOpen}
              aria-label="Open navigation menu"
              className="lg:hidden"
              onClick={() => setIsMobileNavigationOpen(true)}
              ref={menuTriggerRef}
              size="icon"
              variant="ghost"
            >
              <Menu aria-hidden="true" className="size-5" />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {displayName}
              </p>
              <p className="text-xs text-slate-500">{displayRole}</p>
            </div>
          </div>

          <Button
            aria-label="Log out"
            isLoading={logoutMutation.isPending}
            loadingText="Logging out"
            onClick={handleLogout}
            size="sm"
            variant="outline"
          >
            <LogOut aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Log out</span>
          </Button>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
