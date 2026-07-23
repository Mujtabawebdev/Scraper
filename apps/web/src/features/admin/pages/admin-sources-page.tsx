import { Ban, Eye, Plus, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useAppSelector } from "../../../app/store";
import { PaginationControls } from "../../../components/common/pagination-controls";
import { EmptyState } from "../../../components/feedback/empty-state";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { selectCurrentUser } from "../../auth/store/auth.slice";
import { getApiErrorMessage } from "../../../services/api-client";
import { formatDateTime } from "../../../utils/formatters";
import { SourceStatusBadge } from "../components/admin-badges";
import { AdminDialog } from "../components/admin-dialog";
import { AdminPageHeader, AdminQueryError } from "../components/admin-page";
import { useAdminMutations, useAdminSources } from "../hooks/use-admin";
import type {
  AdminSourceFilters,
  ApprovedSource,
  ApprovedSourceType,
  CreateAdminSourceInput,
} from "../types/admin.types";

const defaults: AdminSourceFilters = {
  page: 1,
  pageSize: 20,
  sortBy: "updatedAt",
  sortOrder: "desc",
};

type SourceAction =
  | { type: "view"; source: ApprovedSource }
  | { type: "disable" | "review" | "block"; source: ApprovedSource }
  | { type: "edit"; source: ApprovedSource }
  | { type: "create" };

const emptyCreate: CreateAdminSourceInput = {
  key: "",
  displayName: "",
  sourceType: "PUBLIC_DIRECTORY",
  baseUrl: null,
  requiresApiKey: false,
  requestsPerMinute: 10,
  maxConcurrency: 1,
};

export function AdminSourcesPage() {
  const [filters, setFilters] = useState(defaults);
  const [action, setAction] = useState<SourceAction | null>(null);
  const [reason, setReason] = useState("");
  const [createInput, setCreateInput] = useState(emptyCreate);
  const [status, setStatus] = useState<ApprovedSource["status"]>("REVIEW_REQUIRED");
  const [allowAutomation, setAllowAutomation] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [termsReviewed, setTermsReviewed] = useState(false);
  const [robotsChecked, setRobotsChecked] = useState(false);
  const currentUser = useAppSelector(selectCurrentUser);
  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const query = useAdminSources(filters);
  const mutations = useAdminMutations();

  const close = () => {
    setAction(null);
    setReason("");
    setCreateInput(emptyCreate);
    setStatus("REVIEW_REQUIRED");
    setAllowAutomation(false);
    setEnabled(false);
    setTermsReviewed(false);
    setRobotsChecked(false);
  };

  const openEdit = (source: ApprovedSource) => {
    setAction({ type: "edit", source });
    setStatus(source.status);
    setAllowAutomation(source.allowsAutomatedAccess);
    setEnabled(source.isEnabled);
    setTermsReviewed(Boolean(source.termsReviewedAt));
    setRobotsChecked(Boolean(source.robotsPolicyCheckedAt));
  };

  const submit = async () => {
    try {
      if (action?.type === "create") {
        if (
          createInput.key.trim().length < 3 ||
          createInput.displayName.trim().length < 2
        ) {
          toast.error("Provide a valid key and source name.");
          return;
        }
        await mutations.createSource.mutateAsync(createInput);
      } else if (action?.type === "edit") {
        await mutations.updateSource.mutateAsync({
          sourceId: action.source.id,
          changes: {
            status,
            isEnabled: enabled,
            allowsAutomatedAccess: allowAutomation,
            termsReviewedAt: termsReviewed
              ? action.source.termsReviewedAt ?? new Date().toISOString()
              : null,
            robotsPolicyCheckedAt: robotsChecked
              ? action.source.robotsPolicyCheckedAt ?? new Date().toISOString()
              : null,
            blockedReason:
              status === "BLOCKED"
                ? reason.trim() || action.source.blockedReason
                : null,
            reviewNotes: reason.trim() || action.source.reviewNotes,
          },
        });
      } else if (action && action.type !== "view") {
        if (reason.trim().length < 5) {
          toast.error("Please provide a reason.");
          return;
        }
        if (action.type === "disable") {
          await mutations.disableSource.mutateAsync({
            sourceId: action.source.id,
            reason: reason.trim(),
          });
        } else if (action.type === "review") {
          await mutations.reviewSource.mutateAsync({
            sourceId: action.source.id,
            reason: reason.trim(),
          });
        } else {
          await mutations.updateSource.mutateAsync({
            sourceId: action.source.id,
            changes: {
              status: "BLOCKED",
              isEnabled: false,
              allowsAutomatedAccess: false,
              blockedReason: reason.trim(),
            },
          });
        }
      }
      toast.success("Source governance settings updated.");
      close();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const isPending =
    mutations.createSource.isPending ||
    mutations.updateSource.isPending ||
    mutations.disableSource.isPending ||
    mutations.reviewSource.isPending;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        action={
          isSuperAdmin ? (
            <Button onClick={() => setAction({ type: "create" })}>
              <Plus aria-hidden="true" className="size-4" />
              Create source
            </Button>
          ) : undefined
        }
        description="Manage a deny-by-default allowlist. New sources remain disabled and review-required until policy prerequisites are recorded."
        eyebrow="Compliance"
        title="Approved sources"
      />
      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <Input
          aria-label="Search sources"
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              page: 1,
              search: event.target.value || undefined,
            }))
          }
          placeholder="Search name or key"
          value={filters.search ?? ""}
        />
        <Select
          aria-label="Filter source status"
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              page: 1,
              status: (event.target.value ||
                undefined) as AdminSourceFilters["status"],
            }))
          }
          value={filters.status ?? ""}
        >
          <option value="">All statuses</option>
          <option value="APPROVED">Approved</option>
          <option value="DISABLED">Disabled</option>
          <option value="BLOCKED">Blocked</option>
          <option value="REVIEW_REQUIRED">Review required</option>
        </Select>
        <Button onClick={() => setFilters(defaults)} variant="outline">
          Clear filters
        </Button>
      </section>
      {query.isError ? (
        <AdminQueryError
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {query.isLoading ? (
          <p className="p-8 text-center">Loading governed sources…</p>
        ) : null}
        {query.data?.sources.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No approved sources found" />
          </div>
        ) : null}
        {query.data?.sources.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    {[
                      "Source",
                      "Type",
                      "Status",
                      "Enabled",
                      "Automation",
                      "Robots checked",
                      "Terms reviewed",
                      "Updated",
                      "Actions",
                    ].map((label) => (
                      <th className="px-4 py-3" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {query.data.sources.map((source) => (
                    <tr key={source.id}>
                      <td className="px-4 py-4">
                        <p className="font-semibold">{source.displayName}</p>
                        <p className="font-mono text-xs text-slate-500">
                          {source.key}
                        </p>
                      </td>
                      <td className="px-4 py-4">{source.sourceType}</td>
                      <td className="px-4 py-4">
                        <SourceStatusBadge status={source.status} />
                      </td>
                      <td className="px-4 py-4">
                        {source.isEnabled ? "Yes" : "No"}
                      </td>
                      <td className="px-4 py-4">
                        {source.allowsAutomatedAccess ? "Allowed" : "Not allowed"}
                      </td>
                      <td className="px-4 py-4">
                        {formatDateTime(source.robotsPolicyCheckedAt)}
                      </td>
                      <td className="px-4 py-4">
                        {formatDateTime(source.termsReviewedAt)}
                      </td>
                      <td className="px-4 py-4">
                        {formatDateTime(source.updatedAt)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-max gap-2">
                          <Button
                            onClick={() => setAction({ type: "view", source })}
                            size="sm"
                            variant="outline"
                          >
                            <Eye aria-hidden="true" className="size-4" />
                            View
                          </Button>
                          {isSuperAdmin ? (
                            <>
                              <Button
                                onClick={() => openEdit(source)}
                                size="sm"
                                variant="outline"
                              >
                                Edit
                              </Button>
                              <Button
                                onClick={() =>
                                  setAction({ type: "review", source })
                                }
                                size="sm"
                                variant="outline"
                              >
                                <ShieldAlert
                                  aria-hidden="true"
                                  className="size-4"
                                />
                                Review
                              </Button>
                              <Button
                                onClick={() =>
                                  setAction({ type: "block", source })
                                }
                                size="sm"
                                variant="danger"
                              >
                                <Ban aria-hidden="true" className="size-4" />
                                Block
                              </Button>
                            </>
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
        confirmLabel={action?.type === "view" ? "Close" : "Save source"}
        danger={action?.type === "block" || action?.type === "disable"}
        isPending={isPending}
        onCancel={close}
        onConfirm={
          action?.type === "view" ? close : () => void submit()
        }
        open={action !== null}
        title={
          action?.type === "create"
            ? "Create source for review"
            : action && "source" in action
              ? action.source.displayName
              : "Source policy"
        }
      >
        {action?.type === "view" && "source" in action ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="font-semibold">Base URL</dt>
              <dd className="break-all">{action.source.baseUrl ?? "Not set"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Limits</dt>
              <dd>
                {action.source.requestsPerMinute} req/min ·{" "}
                {action.source.maxConcurrency} concurrent
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Review notes</dt>
              <dd>{action.source.reviewNotes ?? "None"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Blocked reason</dt>
              <dd>{action.source.blockedReason ?? "None"}</dd>
            </div>
          </dl>
        ) : null}
        {action?.type === "create" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              aria-label="Source key"
              onChange={(event) =>
                setCreateInput((current) => ({
                  ...current,
                  key: event.target.value.toLowerCase(),
                }))
              }
              placeholder="example-public-directory"
              value={createInput.key}
            />
            <Input
              aria-label="Source name"
              onChange={(event) =>
                setCreateInput((current) => ({
                  ...current,
                  displayName: event.target.value,
                }))
              }
              placeholder="Source display name"
              value={createInput.displayName}
            />
            <Select
              aria-label="Source type"
              onChange={(event) =>
                setCreateInput((current) => ({
                  ...current,
                  sourceType: event.target.value as ApprovedSourceType,
                }))
              }
              value={createInput.sourceType}
            >
              {[
                "OFFICIAL_API",
                "PUBLIC_DIRECTORY",
                "GOVERNMENT_DATASET",
                "OFFICIAL_WEBSITE",
                "LICENSED_DATASET",
                "CSV_IMPORT",
              ].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
            <Input
              aria-label="Source base URL"
              onChange={(event) =>
                setCreateInput((current) => ({
                  ...current,
                  baseUrl: event.target.value || null,
                }))
              }
              placeholder="https://approved.example"
              type="url"
              value={createInput.baseUrl ?? ""}
            />
          </div>
        ) : null}
        {action?.type === "edit" ? (
          <div className="space-y-3">
            <Select
              aria-label="Source status"
              onChange={(event) =>
                setStatus(event.target.value as ApprovedSource["status"])
              }
              value={status}
            >
              <option value="REVIEW_REQUIRED">Review required</option>
              <option value="APPROVED">Approved</option>
              <option value="DISABLED">Disabled</option>
              <option value="BLOCKED">Blocked</option>
            </Select>
            {[
              ["Automated access reviewed and allowed", allowAutomation, setAllowAutomation],
              ["Enable source", enabled, setEnabled],
              ["Source terms reviewed", termsReviewed, setTermsReviewed],
              ["robots.txt policy checked", robotsChecked, setRobotsChecked],
            ].map(([label, checked, setter]) => (
              <label className="flex items-center gap-3" key={String(label)}>
                <input
                  checked={Boolean(checked)}
                  onChange={(event) =>
                    (setter as (value: boolean) => void)(event.target.checked)
                  }
                  type="checkbox"
                />
                {String(label)}
              </label>
            ))}
            <Input
              aria-label="Policy review note"
              onChange={(event) => setReason(event.target.value)}
              placeholder="Review note or block reason"
              value={reason}
            />
          </div>
        ) : null}
        {action &&
        action.type !== "create" &&
        action.type !== "edit" &&
        action.type !== "view" ? (
          <>
            <p>
              This action immediately disables automated access and is recorded
              in the audit log.
            </p>
            <Input
              aria-label="Source action reason"
              onChange={(event) => setReason(event.target.value)}
              placeholder="Compliance reason"
              value={reason}
            />
          </>
        ) : null}
      </AdminDialog>
    </div>
  );
}
