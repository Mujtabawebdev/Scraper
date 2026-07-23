import type {
  AdminUserRole,
  AdminUserStatus,
  ApprovedSourceStatus,
} from "../types/admin.types";

const base = "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold";

export function UserStatusBadge({ status }: { status: AdminUserStatus }) {
  const style = {
    ACTIVE: "bg-emerald-100 text-emerald-800",
    SUSPENDED: "bg-amber-100 text-amber-900",
    DISABLED: "bg-slate-200 text-slate-700",
  }[status];
  return <span className={`${base} ${style}`}>{status}</span>;
}

export function UserRoleBadge({ role }: { role: AdminUserRole }) {
  const style = {
    USER: "bg-slate-100 text-slate-700",
    ADMIN: "bg-blue-100 text-blue-800",
    SUPER_ADMIN: "bg-violet-100 text-violet-800",
  }[role];
  return <span className={`${base} ${style}`}>{role.replace("_", " ")}</span>;
}

export function SourceStatusBadge({
  status,
}: {
  status: ApprovedSourceStatus;
}) {
  const style = {
    APPROVED: "bg-emerald-100 text-emerald-800",
    DISABLED: "bg-slate-200 text-slate-700",
    BLOCKED: "bg-red-100 text-red-800",
    REVIEW_REQUIRED: "bg-amber-100 text-amber-900",
  }[status];
  return <span className={`${base} ${style}`}>{status.replace("_", " ")}</span>;
}
