import { useMutation, useQuery } from "@tanstack/react-query";
import { FileUp, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import { getApiErrorMessage } from "../../../services/api-client";
import {
  fetchCsvImport,
  importCsv,
  previewCsv,
} from "../api/csv-import.api";
import type { CsvPreview } from "../types/csv-import.types";

export function CsvImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const previewMutation = useMutation({
    mutationFn: previewCsv,
    onSuccess: setPreview,
  });
  const importMutation = useMutation({
    mutationFn: importCsv,
    onSuccess: (result) => {
      setImportId(result.id);
      toast.success("CSV import queued successfully.");
    },
  });
  const statusQuery = useQuery({
    queryKey: ["csv-imports", importId],
    queryFn: () => fetchCsvImport(importId!),
    enabled: Boolean(importId),
    refetchInterval: (query) =>
      ["PENDING", "QUEUED", "PROCESSING"].includes(
        query.state.data?.status ?? "",
      )
        ? 2_000
        : false,
  });
  const canSubmit = Boolean(file && sourceName.trim().length >= 2 && rightsConfirmed);
  const input = file
    ? { file, sourceName: sourceName.trim(), rightsConfirmed }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-brand-700">Authorized data</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
          Licensed CSV import
        </h1>
        <p className="mt-2 text-slate-600">
          Preview and queue bounded business-contact data with durable source
          provenance.
        </p>
      </div>

      <Alert title="Import rights are required" variant="warning">
        Only upload public business data you are licensed or otherwise
        authorized to process. Executables and arbitrary binary files are
        rejected.
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp aria-hidden="true" className="size-5" />
            CSV file
          </CardTitle>
          <CardDescription>
            Required column: business name. Supported optional columns include
            phone, email, website, address, city, state and source record ID.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="csv-source-name">Source attribution</Label>
            <Input
              className="mt-1.5"
              id="csv-source-name"
              maxLength={150}
              onChange={(event) => setSourceName(event.target.value)}
              placeholder="Licensed provider or dataset name"
              value={sourceName}
            />
          </div>
          <div>
            <Label htmlFor="csv-file">CSV file</Label>
            <Input
              accept=".csv,text/csv"
              className="mt-1.5"
              id="csv-file"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
              }}
              type="file"
            />
          </div>
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input
              checked={rightsConfirmed}
              className="mt-1 size-4"
              onChange={(event) => setRightsConfirmed(event.target.checked)}
              type="checkbox"
            />
            <span>
              I confirm I have rights to import and process this public
              business-contact dataset.
            </span>
          </label>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={!canSubmit}
              isLoading={previewMutation.isPending}
              onClick={() => input && previewMutation.mutate(input)}
              type="button"
              variant="outline"
            >
              Preview validation
            </Button>
            <Button
              disabled={!canSubmit || !preview || preview.validRows === 0}
              isLoading={importMutation.isPending}
              onClick={() => input && importMutation.mutate(input)}
              type="button"
            >
              <ShieldCheck aria-hidden="true" className="size-4" />
              Queue import
            </Button>
          </div>
          {previewMutation.isError ? (
            <Alert variant="error">
              {getApiErrorMessage(previewMutation.error)}
            </Alert>
          ) : null}
          {importMutation.isError ? (
            <Alert variant="error">
              {getApiErrorMessage(importMutation.error)}
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle>Validation preview</CardTitle>
            <CardDescription>
              {preview.validRows} valid · {preview.invalidRows} invalid ·{" "}
              {preview.totalRows} total rows
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {preview.preview.map((row) => (
                <li className="rounded-lg border border-slate-200 p-3" key={row.rowNumber}>
                  <span className="font-semibold">{row.businessName}</span>
                  <span className="ml-2 text-slate-500">
                    {row.phone ?? "No phone supplied"}
                  </span>
                </li>
              ))}
            </ul>
            {preview.errors.length > 0 ? (
              <Alert title="Invalid rows" variant="warning">
                {preview.errors.slice(0, 5).map((error) => (
                  <p key={`${error.row}-${error.code}`}>
                    Row {error.row}: {error.message}
                  </p>
                ))}
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {statusQuery.data ? (
        <Alert title={`Import ${statusQuery.data.status}`} variant="info">
          Imported {statusQuery.data.importedRows}; duplicates{" "}
          {statusQuery.data.duplicateRows}; invalid {statusQuery.data.invalidRows}.
        </Alert>
      ) : null}
    </div>
  );
}
