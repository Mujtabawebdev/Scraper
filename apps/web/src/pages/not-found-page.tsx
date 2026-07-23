import { SearchX } from "lucide-react";
import { Link } from "react-router-dom";

import { AppLogo } from "../components/common/app-logo";

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <div className="w-full max-w-lg text-center">
        <div className="mb-8 flex justify-center">
          <AppLogo />
        </div>
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-slate-200 text-slate-700">
          <SearchX aria-hidden="true" className="size-7" />
        </span>
        <p className="mt-6 text-sm font-bold tracking-widest text-brand-700">
          404
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Page not found
        </h1>
        <p className="mt-3 text-slate-600">
          The page you requested does not exist or may have moved.
        </p>
        <Link
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          to="/"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
