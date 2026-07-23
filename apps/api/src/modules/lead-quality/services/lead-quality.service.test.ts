import { describe, expect, it } from "vitest";
import { phoneQualityService } from "./phone-quality.service.js";
import { emailQualityService } from "./email-quality.service.js";
import { websiteQualityService } from "./website-quality.service.js";
import { addressNormalizationService } from "./address-normalization.service.js";
import { duplicateDetectionService } from "./duplicate-detection.service.js";
import { qualityScoringService } from "./quality-scoring.service.js";
import { leadMergeService } from "./lead-merge.service.js";

describe("Phase 10 — Advanced Lead Quality & Verification Services", () => {
  describe("Phone Quality Validation", () => {
    it("validates valid USA phone numbers into E.164 and national formats", () => {
      const result = phoneQualityService.validatePhoneLocal("202-555-4321");
      expect(result.isValidFormat).toBe(true);
      expect(result.phoneNormalized).toBe("+12025554321");
      expect(result.nationalFormat).toBe("(202) 555-4321");
      expect(result.phoneType).toBe("LANDLINE");
      expect(result.activeLineVerified).toBe(false);
    });

    it("identifies toll-free numbers correctly", () => {
      const result = phoneQualityService.validatePhoneLocal("800-555-1212");
      expect(result.isValidFormat).toBe(true);
      expect(result.phoneType).toBe("TOLL_FREE");
    });

    it("parses phone extensions cleanly", () => {
      const result = phoneQualityService.validatePhoneLocal("202-555-4321 ext 104");
      expect(result.isValidFormat).toBe(true);
      expect(result.extension).toBe("104");
      expect(result.phoneNormalized).toBe("+12025554321");
    });


    it("flags test placeholder numbers (555-01xx, 0000000000)", () => {
      const res1 = phoneQualityService.validatePhoneLocal("202-555-0199");
      expect(res1.isPlaceholder).toBe(true);
      expect(res1.status).toBe("PLACEHOLDER");

      const res2 = phoneQualityService.validatePhoneLocal("9999999999");
      expect(res2.isPlaceholder).toBe(true);
      expect(res2.status).toBe("PLACEHOLDER");
    });

  });

  describe("Email Quality Validation", () => {
    it("validates standard valid email syntax", () => {
      const result = emailQualityService.validateEmail("contact@acmecorp.com");
      expect(result.isValidSyntax).toBe(true);
      expect(result.isDomainValid).toBe(true);
      expect(result.domain).toBe("acmecorp.com");
      expect(result.isRoleAccount).toBe(true); // "contact@"
    });

    it("identifies disposable email domains", () => {
      const result = emailQualityService.validateEmail("test@mailinator.com");
      expect(result.isValidSyntax).toBe(true);
      expect(result.isDisposable).toBe(true);
      expect(result.status).toBe("DISPOSABLE");
    });

    it("rejects invalid email syntax", () => {
      const result = emailQualityService.validateEmail("invalid-email-address");
      expect(result.isValidSyntax).toBe(false);
      expect(result.status).toBe("INVALID");
    });
  });

  describe("Website & Domain Validation", () => {
    it("normalizes website URL and extracts registered domain", () => {
      const result = websiteQualityService.validateWebsiteLocal("www.acmecorp.com/about?src=1");
      expect(result.isValidUrl).toBe(true);
      expect(result.normalizedUrl).toBe("https://www.acmecorp.com/about?src=1");
      expect(result.domain).toBe("acmecorp.com");
      expect(result.registeredDomain).toBe("acmecorp.com");
    });

    it("blocks private network and localhost URLs", () => {
      const result1 = websiteQualityService.validateWebsiteLocal("http://localhost:8080");
      expect(result1.isPrivateNetwork).toBe(true);
      expect(result1.status).toBe("PRIVATE_NETWORK");

      const result2 = websiteQualityService.validateWebsiteLocal("http://192.168.1.1/admin");
      expect(result2.isPrivateNetwork).toBe(true);
      expect(result2.status).toBe("PRIVATE_NETWORK");
    });
  });

  describe("Address Normalization", () => {
    it("normalizes US state names to 2-letter USPS abbreviations", () => {
      const result = addressNormalizationService.normalizeAddress({
        addressLine1: "123 Main Street Suite 400",
        city: "Los Angeles",
        state: "California",
        postalCode: "90012-1234",
      });
      expect(result.state).toBe("CA");
      expect(result.postalCode).toBe("90012-1234");
      expect(result.normalizedComparisonString).toBe("123 main street suite 400, los angeles, ca, 90012");
    });
  });

  describe("Advanced Duplicate Detection", () => {
    it("returns EXACT match for identical Google Place IDs", () => {
      const result = duplicateDetectionService.evaluateDuplicateMatch(
        { id: "lead-1", businessName: "Acme Corp", googlePlaceId: "ChIJ12345" },
        { id: "lead-2", businessName: "Acme Corporation", googlePlaceId: "ChIJ12345" }
      );
      expect(result.matchLevel).toBe("EXACT");
      expect(result.matchScore).toBe(100);
      expect(result.autoMergeAllowed).toBe(true);
    });

    it("protects separate branch locations from automatic merging", () => {
      const result = duplicateDetectionService.evaluateDuplicateMatch(
        {
          id: "branch-1",
          businessName: "First National Bank",
          phoneNormalized: "+12025550190",
          city: "Austin",
          state: "TX",
          addressLine1: "100 Main St",
        },
        {
          id: "branch-2",
          businessName: "First National Bank",
          phoneNormalized: "+12025550190",
          city: "Austin",
          state: "TX",
          addressLine1: "500 Congress Ave",
        }
      );
      expect(result.isDuplicate).toBe(true);
      expect(result.matchLevel).toBe("MEDIUM");
      expect(result.autoMergeAllowed).toBe(false);
      expect(result.matchReasons).toContain("Different street addresses indicate branch locations");
    });
  });

  describe("Quality & Completeness Scoring", () => {
    it("computes deterministic 0-100 quality score and tier", () => {
      const scoreResult = qualityScoringService.calculateQualityScore({
        businessName: "Acme Supplies LLC",
        phoneNormalized: "+12025554321",
        email: "contact@acmesupplies.com",
        website: "https://acmesupplies.com",
        addressLine1: "100 Industry Way",
        city: "Austin",
        state: "TX",
        lastVerifiedAt: new Date(),
        approvedSourceCount: 2,
      });

      expect(scoreResult.score).toBeGreaterThanOrEqual(85);
      expect(["EXCELLENT", "GOOD"]).toContain(scoreResult.tier);
    });


    it("computes completeness score", () => {
      const completeResult = qualityScoringService.calculateCompletenessScore({
        businessName: "Acme Supplies LLC",
        phoneNormalized: "+12025550143",
        email: "contact@acmesupplies.com",
        website: "https://acmesupplies.com",
        category: "Industrial Supplies",
        addressLine1: "100 Industry Way",
        city: "Austin",
        state: "TX",
        postalCode: "78701",
      });

      expect(completeResult.score).toBe(100);
    });
  });

  describe("Lead Merge Architecture", () => {
    it("previews field selection and conflict tracking", () => {
      const preview = leadMergeService.createMergePreview(
        {
          id: "canonical-1",
          businessName: "Acme Inc",
          phoneNormalized: "+12025550143",
          email: "sales@acme.com",
          website: "https://acme.com",
          addressLine1: "100 Main St",
          confidenceScore: 80,
        },
        {
          id: "candidate-2",
          businessName: "Acme Incorporated",
          phoneNormalized: "+12025550143",
          email: "info@acme.com",
          website: "https://acme.com",
          addressLine1: "100 Main Street Suite 10",
          confidenceScore: 70,
        },
        ["Exact phone match"]
      );

      expect(preview.canonicalLeadId).toBe("canonical-1");
      expect(preview.candidateLeadId).toBe("candidate-2");
      expect(preview.conflictingValues.length).toBeGreaterThan(0);
    });
  });
});
