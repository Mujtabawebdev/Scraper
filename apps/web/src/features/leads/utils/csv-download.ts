const defaultExportFilename = "leads-export.csv";

const sanitizeFilename = (value: string): string => {
  const sanitized = value
    .replaceAll("\\", "-")
    .replaceAll("/", "-")
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .trim()
    .slice(0, 120);

  if (!sanitized) {
    return defaultExportFilename;
  }
  return sanitized.toLowerCase().endsWith(".csv")
    ? sanitized
    : `${sanitized}.csv`;
};

export const getCsvExportFilename = (
  contentDisposition: string | undefined,
): string => {
  if (!contentDisposition) {
    return defaultExportFilename;
  }

  const encodedMatch = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(
    contentDisposition,
  );
  if (encodedMatch?.[1]) {
    try {
      return sanitizeFilename(decodeURIComponent(encodedMatch[1].trim()));
    } catch {
      return defaultExportFilename;
    }
  }

  const filenameMatch = /filename\s*=\s*"?([^";]+)"?/i.exec(
    contentDisposition,
  );
  return sanitizeFilename(filenameMatch?.[1] ?? "");
};

export const downloadCsvBlob = (blob: Blob, filename: string): void => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
};
