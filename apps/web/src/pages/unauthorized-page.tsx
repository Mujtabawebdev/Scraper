import { ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

export function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
          <ShieldAlert aria-hidden="true" className="size-7" />
        </span>
        <p className="mt-6 text-sm font-bold tracking-widest text-amber-700">
          ACCESS DENIED
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          You do not have permission
        </h1>
        <p className="mt-3 text-slate-600">
          Your current role cannot access this area. No account data was
          changed.
        </p>
        <Link
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          to="/dashboard"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
