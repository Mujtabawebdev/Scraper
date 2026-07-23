import { describe, expect, it } from "vitest";

import { getCsvExportFilename } from "./csv-download";

describe("CSV download filenames", () => {
  it("uses a UTF-8 filename from Content-Disposition", () => {
    expect(
      getCsvExportFilename(
        "attachment; filename*=UTF-8''austin%20plumbers.csv",
      ),
    ).toBe("austin plumbers.csv");
  });

  it("removes path and unsafe filename characters", () => {
    expect(
      getCsvExportFilename('attachment; filename="../leads:<today>.csv"'),
    ).toBe("..-leadstoday.csv");
  });

  it("uses a safe fallback for missing headers", () => {
    expect(getCsvExportFilename(undefined)).toBe("leads-export.csv");
  });
});
