import { describe, expect, it } from "vitest";
import { listLeadsQuerySchema } from "./lead.schemas.js";

describe("listLeadsQuerySchema", () => {
  it("applies safe pagination defaults", () => {
    const result = listLeadsQuerySchema.parse({});
    expect(result).toMatchObject({ page: 1, limit: 20 });
  });

  it("rejects pagination above the maximum", () => {
    expect(listLeadsQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
  });
});
