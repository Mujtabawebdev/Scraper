import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, BriefcaseBusiness, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { FormFieldError } from "../../../components/feedback/form-field-error";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import {
  getApiErrorMessage,
  normalizeApiError,
} from "../../../services/api-client";
import { useCreateScrapingJob } from "../hooks/use-create-scraping-job";
import {
  createScrapingJobSchema,
  type CreateScrapingJobFormInput,
  type CreateScrapingJobFormValues,
} from "../schemas/scraping-job.schemas";
import { APPROVED_SOURCE_OPTIONS } from "../types/scraping-job.types";

const jobFieldNames = [
  "source",
  "searchQuery",
  "location",
  "requestedLimit",
] as const;

export function CreateJobPage() {
  const navigate = useNavigate();
  const createMutation = useCreateScrapingJob();
  const [generalError, setGeneralError] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<
    CreateScrapingJobFormInput,
    unknown,
    CreateScrapingJobFormValues
  >({
    resolver: zodResolver(createScrapingJobSchema),
    defaultValues: {
      source: "fixture-business-directory",
      searchQuery: "",
      location: "",
      requestedLimit: 25,
    },
  });
  const isPending = isSubmitting || createMutation.isPending;

  const onSubmit = async (
    values: CreateScrapingJobFormValues,
  ): Promise<void> => {
    setGeneralError(null);
    try {
      const job = await createMutation.mutateAsync(values);
      toast.success("Scraping job queued successfully.");
      navigate(`/dashboard/jobs/${job.id}`);
    } catch (error: unknown) {
      const apiError = normalizeApiError(error);
      for (const fieldName of jobFieldNames) {
        const message = apiError.fieldErrors[fieldName];
        if (message) {
          setError(fieldName, { message, type: "server" });
        }
      }
      setGeneralError(getApiErrorMessage(apiError));
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-2 rounded-md text-sm font-semibold text-slate-600 hover:text-slate-950"
          to="/dashboard/jobs"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to job history
        </Link>
        <div className="mt-5 flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <BriefcaseBusiness aria-hidden="true" className="size-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-brand-700">New collection</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
              Create scraping job
            </h1>
            <p className="mt-2 text-slate-600">
              Queue a controlled collection run from an approved development
              source.
            </p>
          </div>
        </div>
      </div>

      <Alert title="Permitted source only" variant="info">
        <span className="inline-flex items-start gap-2">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          The fixture directory uses fictional local data. The approved
          development directory requires server-side enablement and a fixed
          administrator-configured origin. Arbitrary URLs are not accepted.
        </span>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Job criteria</CardTitle>
          <CardDescription>
            Choose a business category, target location, and safe result limit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {generalError ? (
            <Alert className="mb-5" variant="error">
              {generalError}
            </Alert>
          ) : null}

          <form
            aria-label="Create scraping job"
            className="space-y-5"
            noValidate
            onSubmit={handleSubmit(onSubmit)}
          >
            <div>
              <Label htmlFor="job-source">Approved source</Label>
              <Select
                {...register("source")}
                aria-describedby={errors.source ? "job-source-error" : undefined}
                className="mt-1.5"
                disabled={isPending}
                id="job-source"
                invalid={Boolean(errors.source)}
              >
                {APPROVED_SOURCE_OPTIONS.map((source) => (
                  <option key={source.value} value={source.value}>
                    {source.label}
                  </option>
                ))}
              </Select>
              <FormFieldError
                id="job-source-error"
                message={errors.source?.message}
              />
            </div>

            <div>
              <Label htmlFor="job-search-query">Search query or category</Label>
              <Input
                {...register("searchQuery")}
                aria-describedby={
                  errors.searchQuery ? "job-search-query-error" : undefined
                }
                className="mt-1.5"
                disabled={isPending}
                id="job-search-query"
                invalid={Boolean(errors.searchQuery)}
                maxLength={100}
                placeholder="e.g. plumbers"
              />
              <FormFieldError
                id="job-search-query-error"
                message={errors.searchQuery?.message}
              />
            </div>

            <div>
              <Label htmlFor="job-location">Location</Label>
              <Input
                {...register("location")}
                aria-describedby={
                  errors.location ? "job-location-error" : undefined
                }
                className="mt-1.5"
                disabled={isPending}
                id="job-location"
                invalid={Boolean(errors.location)}
                maxLength={100}
                placeholder="e.g. Austin, TX"
              />
              <FormFieldError
                id="job-location-error"
                message={errors.location?.message}
              />
            </div>

            <div>
              <Label htmlFor="job-requested-limit">Requested lead limit</Label>
              <Input
                {...register("requestedLimit", { valueAsNumber: true })}
                aria-describedby={[
                  "job-requested-limit-help",
                  errors.requestedLimit ? "job-requested-limit-error" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                className="mt-1.5"
                disabled={isPending}
                id="job-requested-limit"
                inputMode="numeric"
                invalid={Boolean(errors.requestedLimit)}
                max={100}
                min={1}
                type="number"
              />
              <p
                className="mt-1.5 text-xs text-slate-500"
                id="job-requested-limit-help"
              >
                Development jobs can request between 1 and 100 leads.
              </p>
              <FormFieldError
                id="job-requested-limit-error"
                message={errors.requestedLimit?.message}
              />
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                to="/dashboard/jobs"
              >
                Cancel
              </Link>
              <Button
                isLoading={isPending}
                loadingText="Queueing job..."
                type="submit"
              >
                Queue scraping job
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
