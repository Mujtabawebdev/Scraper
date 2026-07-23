import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { LeadSummary } from "../types/lead.types";
import { LeadTable } from "./lead-table";

const lead: LeadSummary = {
  id: "lead-1",
  businessName: "Austin Pipe Works",
  phone: "+1 512 555 0100",
  normalizedPhone: "+15125550100",
  phoneExtension: null,
  phoneCountryCode: "US",
  phoneNationalFormat: "(512) 555-0100",
  phoneType: "LANDLINE",
  phoneValidationStatus: "VALID",
  email: "hello@example.test",
  website: "https://example.test/profile",
  category: "Plumbing",
  city: "Austin",
  state: "TX",
  source: "fixture-business-directory",
  sourceType: "BUSINESS_DIRECTORY",
  confidenceScore: 85,
  confidenceLevel: "HIGH",
  lastVerifiedAt: "2026-07-23T12:00:00.000Z",
  provenanceCount: 1,
  createdAt: "2026-07-23T12:00:00.000Z",
};

describe("LeadTable", () => {
  it("renders contact links and secures external website navigation", () => {
    render(
      <MemoryRouter>
        <LeadTable leads={[lead]} returnTo="/dashboard/leads?state=TX" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Austin Pipe Works")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: lead.phone ?? "" })).toHaveAttribute(
      "href",
      `tel:${lead.phone}`,
    );
    expect(screen.getByRole("link", { name: lead.email ?? "" })).toHaveAttribute(
      "href",
      `mailto:${lead.email}`,
    );
    expect(screen.getByRole("link", { name: "Website" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(screen.getByRole("link", { name: "Website" })).toHaveAttribute(
      "target",
      "_blank",
    );
  });

  it("does not render an unsafe website as an external link", () => {
    render(
      <MemoryRouter>
        <LeadTable
          leads={[{ ...lead, website: "javascript:alert(1)" }]}
          returnTo="/dashboard/leads"
        />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("link", { name: "Website" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
  });
});
