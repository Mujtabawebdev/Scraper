import { useMutation } from "@tanstack/react-query";

import { exportLeadsCsv } from "../api/leads.api";
import { downloadCsvBlob } from "../utils/csv-download";

export const useExportLeads = () =>
  useMutation({
    mutationFn: exportLeadsCsv,
    onSuccess: ({ blob, filename }) => {
      downloadCsvBlob(blob, filename);
    },
  });
