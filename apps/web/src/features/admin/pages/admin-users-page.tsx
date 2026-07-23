import { Search, Shield, UserCog } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { PaginationControls } from "../../../components/common/pagination-controls";
import { EmptyState } from "../../../components/feedback/empty-state";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { useAppSelector } from "../../../app/store";
import { selectCurrentUser } from "../../auth/store/auth.slice";
import { getApiErrorMessage } from "../../../services/api-client";
import {
  UserRoleBadge,
  UserStatusBadge,
} from "../components/admin-badges";
import { AdminDialog } from "../components/admin-dialog";
import { AdminPageHeader, AdminQueryError } from "../components/admin-page";
import { useAdminMutations, useAdminUsers } from "../hooks/use-admin";
import type {
  AdminUserFilters,
  AdminUserListItem,
  AdminUserRole,
  AdminUserStatus,
} from "../types/admin.types";
import { formatDateTime } from "../../../utils/formatters";

const defaults: AdminUserFilters = {
  page: 1,
  pageSize: 20,
  sortBy: "createdAt",
  sortOrder: "desc",
};

type PendingAction =
  | {
      type: "status";
      user: AdminUserListItem;
      value: AdminUserStatus;
    }
  | { type: "role"; user: AdminUserListItem; value: AdminUserRole };

export function AdminUsersPage() {
  const [filters, setFilters] = useState(defaults);
  const [draftSearch, setDraftSearch] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");
  const currentUser = useAppSelector(selectCurrentUser);
  const query = useAdminUsers(filters);
  const mutations = useAdminMutations();

  const submitAction = async () => {
    if (!pending || reason.trim().length < 5) {
      toast.error("Please provide a reason of at least 5 characters.");
      return;
    }
    try {
      if (pending.type === "status") {
        await mutations.updateStatus.mutateAsync({
          userId: pending.user.id,
          status: pending.value,
          reason: reason.trim(),
        });
      } else {
        await mutations.updateRole.mutateAsync({
          userId: pending.user.id,
          role: pending.value,
          reason: reason.trim(),
        });
      }
      toast.success("User account updated successfully.");
      setPending(null);
      setReason("");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        description="Search accounts, inspect safe activity totals, and apply audited role or status controls."
        eyebrow="Access control"
        title="User management"
      />
      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-5">
        <form
          className="flex gap-2 md:col-span-2"
          onSubmit={(event) => {
            event.preventDefault();
            setFilters((current) => ({
              ...current,
              page: 1,
              search: draftSearch.trim() || undefined,
            }));
          }}
        >
          <Input
            aria-label="Search users"
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Name or email"
            value={draftSearch}
          />
          <Button aria-label="Apply user search" size="icon" type="submit">
            <Search aria-hidden="true" className="size-4" />
          </Button>
        </form>
        <Select
          aria-label="Filter by role"
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              page: 1,
              role: (event.target.value || undefined) as
                | AdminUserRole
                | undefined,
            }))
          }
          value={filters.role ?? ""}
        >
          <option value="">All roles</option>
          <option value="USER">User</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super admin</option>
        </Select>
        <Select
          aria-label="Filter by status"
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              page: 1,
              status: (event.target.value || undefined) as
                | AdminUserStatus
                | undefined,
            }))
          }
          value={filters.status ?? ""}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DISABLED">Disabled</option>
        </Select>
        <Button
          onClick={() => {
            setFilters(defaults);
            setDraftSearch("");
          }}
          variant="outline"
        >
          Clear filters
        </Button>
      </section>

      {query.isError ? (
        <AdminQueryError
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {query.isLoading ? (
          <p className="p-8 text-center text-slate-600">Loading users…</p>
        ) : null}
        {!query.isLoading && query.data?.users.length === 0 ? (
          <div className="p-4">
            <EmptyState
              description="No account matches the selected filters."
              title="No users found"
            />
          </div>
        ) : null}
        {query.data?.users.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    {[
                      "Name",
                      "Role",
                      "Status",
                      "Last login",
                      "Created",
                      "Jobs",
                      "Leads",
                      "Actions",
                    ].map((label) => (
                      <th className="px-4 py-3 font-semibold" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {query.data.users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-950">
                          {user.fullName}
                        </p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </td>
                      <td className="px-4 py-4">
                        <UserRoleBadge role={user.role} />
                      </td>
                      <td className="px-4 py-4">
                        <UserStatusBadge status={user.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                        {formatDateTime(user.lastLoginAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                        {formatDateTime(user.createdAt)}
                      </td>
                      <td className="px-4 py-4">{user.totalJobs}</td>
                      <td className="px-4 py-4">{user.totalLeads}</td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-max gap-2">
                          <Link
                            className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-50"
                            to={`/admin/users/${user.id}`}
                          >
                            View
                          </Link>
                          {user.id !== currentUser?.id &&
                          user.role === "USER" ? (
                            <Button
                              onClick={() =>
                                setPending({
                                  type: "status",
                                  user,
                                  value:
                                    user.status === "ACTIVE"
                                      ? "SUSPENDED"
                                      : "ACTIVE",
                                })
                              }
                              size="sm"
                              variant="outline"
                            >
                              <UserCog aria-hidden="true" className="size-4" />
                              {user.status === "ACTIVE"
                                ? "Suspend"
                                : "Reactivate"}
                            </Button>
                          ) : null}
                          {currentUser?.role === "SUPER_ADMIN" &&
                          user.id !== currentUser.id ? (
                            <Button
                              onClick={() =>
                                setPending({
                                  type: "role",
                                  user,
                                  value:
                                    user.role === "USER" ? "ADMIN" : "USER",
                                })
                              }
                              size="sm"
                              variant="outline"
                            >
                              <Shield aria-hidden="true" className="size-4" />
                              {user.role === "USER" ? "Promote" : "Demote"}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              disabled={query.isFetching}
              onPageChange={(page) =>
                setFilters((current) => ({ ...current, page }))
              }
              pagination={query.data.pagination}
            />
          </>
        ) : null}
      </section>
      <AdminDialog
        confirmLabel={pending?.type === "role" ? "Change role" : "Change status"}
        danger={
          pending?.type === "status" &&
          (pending.value === "SUSPENDED" || pending.value === "DISABLED")
        }
        isPending={
          mutations.updateStatus.isPending || mutations.updateRole.isPending
        }
        onCancel={() => {
          setPending(null);
          setReason("");
        }}
        onConfirm={() => void submitAction()}
        open={pending !== null}
        title={
          pending?.type === "role"
            ? `Change ${pending.user.fullName}'s role?`
            : `Change ${pending?.user.fullName ?? "user"}'s status?`
        }
      >
        <p>
          This audited change revokes all active sessions. Suspending or
          disabling an account also cancels active collection jobs.
        </p>
        <Select
          aria-label="New value"
          onChange={(event) => {
            if (!pending) return;
            setPending(
              pending.type === "status"
                ? {
                    ...pending,
                    value: event.target.value as AdminUserStatus,
                  }
                : { ...pending, value: event.target.value as AdminUserRole },
            );
          }}
          value={pending?.value ?? ""}
        >
          {pending?.type === "status" ? (
            <>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="DISABLED">Disabled</option>
            </>
          ) : (
            <>
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super admin</option>
            </>
          )}
        </Select>
        <Input
          aria-label="Reason"
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason for this change"
          value={reason}
        />
      </AdminDialog>
    </div>
  );
}
