import type {
  LeadCompletenessScore,
  LeadConfidenceLevel,
  LeadFreshnessStatus,
  LeadQualityScore,
  LeadReviewStatus,
  LeadVerificationStatus,
} from "@lead-saas/shared-types";
import { phoneQualityService } from "./phone-quality.service.js";
import { emailQualityService } from "./email-quality.service.js";
import { websiteQualityService } from "./website-quality.service.js";

export type QualityScoringInput = {
  businessName: string;
  phoneRaw?: string | null;
  phoneNormalized?: string | null;
  email?: string | null;
  website?: string | null;
  category?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  provenanceCount?: number;
  approvedSourceCount?: number;
  lastVerifiedAt?: Date | string | null;
  verificationStatus?: LeadVerificationStatus | null;
  unresolvedIssueCount?: number;
};

export class QualityScoringService {
  /**
   * Calculate 0–100 Lead Quality Score deterministically.
   * Quality score measures contactability, validity, and trustworthiness.
   */
  public calculateQualityScore(input: QualityScoringInput): LeadQualityScore {
    const phoneVal = phoneQualityService.validatePhoneLocal(input.phoneNormalized || input.phoneRaw);
    const emailVal = emailQualityService.validateEmail(input.email);
    const webVal = websiteQualityService.validateWebsiteLocal(input.website);

    const hasValidPhone = phoneVal.isValidFormat ? 25 : 0;
    const hasValidEmail = emailVal.isValidSyntax && emailVal.isDomainValid ? 20 : 0;
    const hasWorkingWebsite = webVal.isValidUrl && !webVal.isPrivateNetwork ? 15 : 0;
    const hasBusinessName = input.businessName && input.businessName.trim().length >= 2 ? 10 : 0;
    const hasCompleteAddress = input.addressLine1 && input.addressLine1.trim().length >= 3 ? 10 : 0;
    const hasCityAndState = input.city && input.state ? 5 : 0;
    const approvedSourceCount = (input.approvedSourceCount || input.provenanceCount || 1) >= 2 ? 5 : (input.approvedSourceCount || 1) > 0 ? 3 : 0;

    let recentVerification = 0;
    if (input.lastVerifiedAt) {
      const daysSince = this.daysBetween(new Date(input.lastVerifiedAt), new Date());
      if (daysSince <= 30) recentVerification = 5;
      else if (daysSince <= 90) recentVerification = 3;
    }

    const noConflicts = (input.unresolvedIssueCount || 0) === 0 ? 5 : 0;

    const score = Math.min(
      100,
      hasValidPhone +
        hasValidEmail +
        hasWorkingWebsite +
        hasBusinessName +
        hasCompleteAddress +
        hasCityAndState +
        approvedSourceCount +
        recentVerification +
        noConflicts
    );

    let tier: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "VERY_POOR" = "VERY_POOR";
    if (score >= 90) tier = "EXCELLENT";
    else if (score >= 75) tier = "GOOD";
    else if (score >= 50) tier = "FAIR";
    else if (score >= 25) tier = "POOR";

    const explanations: string[] = [];
    if (phoneVal.isValidFormat) explanations.push("Valid phone number format (+25)");
    else explanations.push("Missing or invalid phone number (+0)");

    if (emailVal.isValidSyntax && emailVal.isDomainValid) explanations.push("Valid email syntax and domain (+20)");
    else explanations.push("Missing or invalid email (+0)");

    if (webVal.isValidUrl) explanations.push("Valid official website URL (+15)");
    if (hasBusinessName) explanations.push("Complete business name (+10)");
    if (hasCompleteAddress) explanations.push("Street address present (+10)");
    if (hasCityAndState) explanations.push("City and state present (+5)");
    if (approvedSourceCount > 0) explanations.push("Verified source provenance (+5)");
    if (recentVerification > 0) explanations.push("Recently verified data (+5)");

    return {
      score,
      tier,
      breakdown: {
        hasValidPhone,
        hasValidEmail,
        hasWorkingWebsite,
        hasBusinessName,
        hasCompleteAddress,
        hasCityAndState,
        approvedSourceCount,
        recentVerification,
        noConflicts,
      },
      explanation: explanations,
    };
  }

  /**
   * Calculate 0–100 Completeness Score.
   * Completeness score measures how fully populated the lead record fields are.
   */
  public calculateCompletenessScore(input: QualityScoringInput): LeadCompletenessScore {
    const businessName = input.businessName && input.businessName.trim() ? 15 : 0;
    const phone = input.phoneNormalized || input.phoneRaw ? 20 : 0;
    const email = input.email && input.email.trim() ? 15 : 0;
    const website = input.website && input.website.trim() ? 15 : 0;
    const category = input.category && input.category.trim() ? 10 : 0;
    const address = input.addressLine1 && input.addressLine1.trim() ? 10 : 0;
    const city = input.city && input.city.trim() ? 5 : 0;
    const state = input.state && input.state.trim() ? 5 : 0;
    const postalCode = input.postalCode && input.postalCode.trim() ? 5 : 0;
    const provenance = (input.provenanceCount || 1) >= 1 ? 5 : 0;

    const score = Math.min(
      100,
      businessName + phone + email + website + category + address + city + state + postalCode + provenance
    );

    return {
      score,
      breakdown: {
        businessName,
        phone,
        email,
        website,
        category,
        address,
        city,
        state,
        postalCode,
        provenance,
      },
    };
  }

  /**
   * Recalculate confidence score and confidence level.
   */
  public calculateConfidenceScore(
    baseScore: number,
    provenanceCount: number,
    hasOfficialWebsiteMatch: boolean,
    hasGooglePlaceMatch: boolean
  ): { confidenceScore: number; confidenceLevel: LeadConfidenceLevel } {
    let score = baseScore;
    if (provenanceCount >= 2) score += 15;
    if (hasOfficialWebsiteMatch) score += 20;
    if (hasGooglePlaceMatch) score += 15;

    const finalScore = Math.min(100, Math.max(0, score));

    let confidenceLevel: LeadConfidenceLevel = "VERY_LOW";
    if (finalScore >= 80) confidenceLevel = "HIGH";
    else if (finalScore >= 60) confidenceLevel = "MEDIUM";
    else if (finalScore >= 40) confidenceLevel = "LOW";

    return { confidenceScore: finalScore, confidenceLevel };
  }

  /**
   * Determine Lead Freshness Status.
   */
  public determineFreshness(
    lastVerifiedAt: Date | string | null | undefined,
    freshDays = 30,
    agingDays = 90
  ): { freshnessStatus: LeadFreshnessStatus; staleAt: Date | null; nextVerificationAt: Date | null } {
    if (!lastVerifiedAt) {
      return {
        freshnessStatus: "UNKNOWN",
        staleAt: new Date(),
        nextVerificationAt: new Date(),
      };
    }

    const verifiedDate = new Date(lastVerifiedAt);
    const now = new Date();
    const daysSince = this.daysBetween(verifiedDate, now);

    const staleAt = new Date(verifiedDate.getTime() + agingDays * 24 * 60 * 60 * 1000);
    const nextVerificationAt = new Date(verifiedDate.getTime() + freshDays * 24 * 60 * 60 * 1000);

    if (daysSince <= freshDays) {
      return { freshnessStatus: "FRESH", staleAt, nextVerificationAt };
    } else if (daysSince <= agingDays) {
      return { freshnessStatus: "AGING", staleAt, nextVerificationAt };
    } else {
      return { freshnessStatus: "STALE", staleAt, nextVerificationAt };
    }
  }

  /**
   * Determine Verification Status.
   */
  public determineVerificationStatus(
    phoneVal: { isValidFormat: boolean; isPlaceholder: boolean; status: string },
    emailVal: { isValidSyntax: boolean; isDomainValid: boolean; isDisposable: boolean },
    webVal: { isValidUrl: boolean }
  ): LeadVerificationStatus {
    if (phoneVal.isPlaceholder || emailVal.isDisposable) return "VERIFICATION_FAILED";
    if (phoneVal.isValidFormat && emailVal.isValidSyntax && webVal.isValidUrl) return "VERIFIED";
    if (phoneVal.isValidFormat || (emailVal.isValidSyntax && emailVal.isDomainValid)) return "PARTIALLY_VERIFIED";
    if (!phoneVal.isValidFormat && !emailVal.isValidSyntax) return "NO_CONTACT_DATA";
    return "UNVERIFIED";
  }

  /**
   * Determine Lead Review Status.
   */
  public determineReviewStatus(
    qualityScore: number,
    unresolvedIssueCount: number,
    duplicateCandidateCount: number
  ): LeadReviewStatus {
    if (duplicateCandidateCount > 0 || unresolvedIssueCount > 0 || qualityScore < 40) {
      return "REVIEW_REQUIRED";
    }
    return "NOT_REQUIRED";
  }

  private daysBetween(date1: Date, date2: Date): number {
    const diffMs = Math.abs(date2.getTime() - date1.getTime());
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
}

export const qualityScoringService = new QualityScoringService();
