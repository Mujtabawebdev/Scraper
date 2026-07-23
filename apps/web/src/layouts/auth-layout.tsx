import { Link, Outlet } from "react-router-dom";

import { AppLogo } from "../components/common/app-logo";

export function AuthLayout() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-slate-50">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-100/70 to-transparent"
      />

      <header className="relative mx-auto flex w-full max-w-6xl items-center px-5 py-6 sm:px-8">
        <Link
          aria-label="LeadSaaS home"
          className="rounded-xl"
          to="/"
        >
          <AppLogo />
        </Link>
      </header>

      <div className="relative flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>

      <footer className="relative px-5 py-6 text-center text-xs text-slate-500">
        Secure business lead operations, built for accountable teams.
      </footer>
    </main>
  );
}
