import { apiClient } from "../../../services/api-client";
import type {
  CsvImportSummary,
  CsvPreview,
} from "../types/csv-import.types";

type Success<T> = { success: true; data: T };

const formData = (input: {
  file: File;
  sourceName: string;
  rightsConfirmed: boolean;
}): FormData => {
  const data = new FormData();
  data.append("file", input.file);
  data.append("sourceName", input.sourceName);
  data.append("rightsConfirmed", String(input.rightsConfirmed));
  return data;
};

export const previewCsv = async (input: {
  file: File;
  sourceName: string;
  rightsConfirmed: boolean;
}): Promise<CsvPreview> => {
  const response = await apiClient.post<
    Success<{ preview: CsvPreview }>
  >("/imports/csv/preview", formData(input));
  return response.data.data.preview;
};

export const importCsv = async (input: {
  file: File;
  sourceName: string;
  rightsConfirmed: boolean;
}): Promise<CsvImportSummary> => {
  const response = await apiClient.post<
    Success<{ import: CsvImportSummary }>
  >("/imports/csv", formData(input));
  return response.data.data.import;
};

export const fetchCsvImport = async (
  importId: string,
): Promise<CsvImportSummary> => {
  const response = await apiClient.get<
    Success<{ import: CsvImportSummary }>
  >(`/imports/${encodeURIComponent(importId)}`);
  return response.data.data.import;
};
