export type DuplicateMatchResult = {
  isDuplicate: boolean;
  matchScore: number; // 0–100
  matchLevel: "EXACT" | "HIGH" | "MEDIUM" | "LOW";
  matchReasons: string[];
  autoMergeAllowed: boolean;
};

const GENERIC_NAME_TOKENS = new Set([
  "cafe",
  "restaurant",
  "store",
  "shop",
  "salon",
  "spa",
  "center",
  "clinic",
  "agency",
  "services",
  "solutions",
  "group",
  "llc",
  "inc",
  "corp",
  "co",
  "company",
  "main",
  "street",
  "first",
  "national",
  "american",
  "city",
  "town",
  "express",
  "auto",
  "pizza",
  "bakery",
  "barber",
]);

export class DuplicateDetectionService {
  /**
   * Compare two leads deterministically using layered matching.
   */
  public evaluateDuplicateMatch(
    leadA: {
      id: string;
      businessName: string;
      phoneNormalized?: string | null;
      email?: string | null;
      domain?: string | null;
      addressLine1?: string | null;
      city?: string | null;
      state?: string | null;
      googlePlaceId?: string | null;
      sourceName?: string | null;
      sourceExternalId?: string | null;
    },
    leadB: {
      id: string;
      businessName: string;
      phoneNormalized?: string | null;
      email?: string | null;
      domain?: string | null;
      addressLine1?: string | null;
      city?: string | null;
      state?: string | null;
      googlePlaceId?: string | null;
      sourceName?: string | null;
      sourceExternalId?: string | null;
    }
  ): DuplicateMatchResult {
    if (leadA.id === leadB.id) {
      return {
        isDuplicate: false,
        matchScore: 0,
        matchLevel: "LOW",
        matchReasons: ["Same lead ID"],
        autoMergeAllowed: false,
      };
    }

    const reasons: string[] = [];
    let score = 0;

    // Tier 1: Exact Google Place ID match
    if (leadA.googlePlaceId && leadB.googlePlaceId && leadA.googlePlaceId === leadB.googlePlaceId) {
      reasons.push("Exact Google Place ID match");
      return {
        isDuplicate: true,
        matchScore: 100,
        matchLevel: "EXACT",
        matchReasons: reasons,
        autoMergeAllowed: true,
      };
    }

    // Tier 1: Exact Source + SourceRecordId match
    if (
      leadA.sourceName &&
      leadB.sourceName &&
      leadA.sourceName === leadB.sourceName &&
      leadA.sourceExternalId &&
      leadB.sourceExternalId &&
      leadA.sourceExternalId === leadB.sourceExternalId
    ) {
      reasons.push("Exact source record ID match");
      return {
        isDuplicate: true,
        matchScore: 100,
        matchLevel: "EXACT",
        matchReasons: reasons,
        autoMergeAllowed: true,
      };
    }

    // Tier 1: Exact phone + city/state match
    const samePhone = Boolean(
      leadA.phoneNormalized &&
        leadB.phoneNormalized &&
        leadA.phoneNormalized === leadB.phoneNormalized
    );

    const sameCityState = Boolean(
      leadA.city &&
        leadB.city &&
        leadA.city.toLowerCase() === leadB.city.toLowerCase() &&
        leadA.state &&
        leadB.state &&
        leadA.state.toLowerCase() === leadB.state.toLowerCase()
    );

    const sameAddress = Boolean(
      leadA.addressLine1 &&
        leadB.addressLine1 &&
        this.normalizeText(leadA.addressLine1) === this.normalizeText(leadB.addressLine1)
    );

    const differentAddress = Boolean(
      leadA.addressLine1 &&
        leadB.addressLine1 &&
        this.normalizeText(leadA.addressLine1) !== this.normalizeText(leadB.addressLine1)
    );

    if (samePhone && sameCityState) {
      reasons.push("Exact phone number and city/state match");
      if (!differentAddress) {
        return {
          isDuplicate: true,
          matchScore: 98,
          matchLevel: "EXACT",
          matchReasons: reasons,
          autoMergeAllowed: true,
        };
      }
      reasons.push("Different street addresses indicate branch locations");
      return {
        isDuplicate: true,
        matchScore: 75,
        matchLevel: "MEDIUM",
        matchReasons: reasons,
        autoMergeAllowed: false, // Do not auto-merge branch locations
      };
    }

    // Tier 1: Same registered domain + compatible address
    const sameDomain = Boolean(
      leadA.domain && leadB.domain && leadA.domain.toLowerCase() === leadB.domain.toLowerCase()
    );

    if (sameDomain && (sameCityState || sameAddress)) {
      reasons.push("Exact domain and location match");
      return {
        isDuplicate: true,
        matchScore: 95,
        matchLevel: "HIGH",
        matchReasons: reasons,
        autoMergeAllowed: true,
      };
    }

    // Business name normalization & similarity
    const nameA = this.normalizeText(leadA.businessName);
    const nameB = this.normalizeText(leadB.businessName);
    const sameName = nameA === nameB;
    const isGenericName = this.isGenericBusinessName(nameA) || this.isGenericBusinessName(nameB);

    if (sameName && !isGenericName) {
      score += 40;
      reasons.push("Identical business name");
    } else if (sameName && isGenericName) {
      score += 15;
      reasons.push("Identical generic business name (requires additional contact match)");
    } else {
      const sim = this.calculateJaccardSimilarity(nameA, nameB);
      if (sim >= 0.8) {
        score += 30;
        reasons.push(`High name similarity (${Math.round(sim * 100)}%)`);
      } else if (sim >= 0.6) {
        score += 15;
        reasons.push(`Moderate name similarity (${Math.round(sim * 100)}%)`);
      }
    }

    if (samePhone) {
      score += 35;
      reasons.push("Matching phone number");
    }

    if (sameDomain) {
      score += 30;
      reasons.push("Matching domain");
    }

    if (sameAddress) {
      score += 25;
      reasons.push("Matching street address");
    } else if (differentAddress) {
      // Branch protection penalty
      score = Math.max(0, score - 20);
      reasons.push("Different street address (branch protection applied)");
    }

    if (sameCityState) {
      score += 10;
      reasons.push("Matching city and state");
    }

    const finalScore = Math.min(100, score);
    const isDuplicate = finalScore >= 60;
    let matchLevel: "EXACT" | "HIGH" | "MEDIUM" | "LOW" = "LOW";

    if (finalScore >= 90) matchLevel = "EXACT";
    else if (finalScore >= 80) matchLevel = "HIGH";
    else if (finalScore >= 60) matchLevel = "MEDIUM";

    return {
      isDuplicate,
      matchScore: finalScore,
      matchLevel,
      matchReasons: reasons,
      autoMergeAllowed: finalScore >= 95 && !differentAddress,
    };
  }

  private normalizeText(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private isGenericBusinessName(name: string): boolean {
    const tokens = name.split(" ");
    const nonGenericTokens = tokens.filter((t) => !GENERIC_NAME_TOKENS.has(t) && t.length > 2);
    return nonGenericTokens.length === 0;
  }

  private calculateJaccardSimilarity(strA: string, strB: string): number {
    const setA = new Set(strA.split(" "));
    const setB = new Set(strB.split(" "));
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }
}

export const duplicateDetectionService = new DuplicateDetectionService();
