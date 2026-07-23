import { describe, expect, it } from "vitest";

import { serializeHttpResponseForLog } from "./logger.js";

describe("HTTP response log serialization", () => {
  it("omits response headers so Set-Cookie values cannot enter automatic logs", () => {
    const serializedResponse = {
      statusCode: 201,
      headers: {
        "set-cookie": "lead_saas_refresh_token=sensitive-test-value",
      },
    };

    expect(serializeHttpResponseForLog(serializedResponse)).toEqual({
      statusCode: 201,
    });
    expect(JSON.stringify(serializeHttpResponseForLog(serializedResponse))).not.toContain(
      "sensitive-test-value",
    );
  });
});
