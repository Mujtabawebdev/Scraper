import type { LeadMergePreview } from "@lead-saas/shared-types";
import { qualityScoringService } from "./quality-scoring.service.js";

export type FieldSelectionResult = {
  businessName: { value: string; selectedFromLeadId: string; reason: string };
  phone: { value: string | null; selectedFromLeadId: string; reason: string };
  email: { value: string | null; selectedFromLeadId: string; reason: string };
  website: { value: string | null; selectedFromLeadId: string; reason: string };
  address: { value: string | null; selectedFromLeadId: string; reason: string };
  city: { value: string | null; selectedFromLeadId: string; reason: string };
  state: { value: string | null; selectedFromLeadId: string; reason: string };
  postalCode: { value: string | null; selectedFromLeadId: string; reason: string };
};

export class LeadMergeService {
  /**
   * Deterministically select primary field values between canonical lead and candidate lead.
   */
  public selectPrimaryValues(
    canonicalLead: {
      id: string;
      businessName: string;
      phoneNormalized?: string | null;
      email?: string | null;
      website?: string | null;
      addressLine1?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      confidenceScore?: number;
      collectedAt?: Date | string;
    },
    candidateLead: {
      id: string;
      businessName: string;
      phoneNormalized?: string | null;
      email?: string | null;
      website?: string | null;
      addressLine1?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      confidenceScore?: number;
      collectedAt?: Date | string;
    }
  ): FieldSelectionResult {
    const canonicalScore = canonicalLead.confidenceScore || 50;
    const candidateScore = candidateLead.confidenceScore || 50;

    // Business Name: prefer canonical unless candidate is longer and canonical is short
    let selectedName = canonicalLead.businessName;
    let nameLeadId = canonicalLead.id;
    let nameReason = "Preserved from canonical lead";

    if (!selectedName || (candidateLead.businessName && candidateLead.businessName.length > selectedName.length + 5)) {
      selectedName = candidateLead.businessName;
      nameLeadId = candidateLead.id;
      nameReason = "Selected longer, more complete name from candidate lead";
    }

    // Phone: prefer valid phone from lead with higher confidence or canonical
    const phone = this.selectField(
      canonicalLead.phoneNormalized,
      candidateLead.phoneNormalized,
      canonicalLead.id,
      candidateLead.id,
      canonicalScore,
      candidateScore,
      "Phone"
    );

    // Email
    const email = this.selectField(
      canonicalLead.email,
      candidateLead.email,
      canonicalLead.id,
      candidateLead.id,
      canonicalScore,
      candidateScore,
      "Email"
    );

    // Website
    const website = this.selectField(
      canonicalLead.website,
      candidateLead.website,
      canonicalLead.id,
      candidateLead.id,
      canonicalScore,
      candidateScore,
      "Website"
    );

    // Address
    const address = this.selectField(
      canonicalLead.addressLine1,
      candidateLead.addressLine1,
      canonicalLead.id,
      candidateLead.id,
      canonicalScore,
      candidateScore,
      "Address"
    );

    // City
    const city = this.selectField(
      canonicalLead.city,
      candidateLead.city,
      canonicalLead.id,
      candidateLead.id,
      canonicalScore,
      candidateScore,
      "City"
    );

    // State
    const state = this.selectField(
      canonicalLead.state,
      candidateLead.state,
      canonicalLead.id,
      candidateLead.id,
      canonicalScore,
      candidateScore,
      "State"
    );

    // Postal Code
    const postalCode = this.selectField(
      canonicalLead.postalCode,
      candidateLead.postalCode,
      canonicalLead.id,
      candidateLead.id,
      canonicalScore,
      candidateScore,
      "Postal code"
    );

    return {
      businessName: { value: selectedName, selectedFromLeadId: nameLeadId, reason: nameReason },
      phone,
      email,
      website,
      address,
      city,
      state,
      postalCode,
    };
  }

  private selectField(
    valCanonical: string | null | undefined,
    valCandidate: string | null | undefined,
    canonicalId: string,
    candidateId: string,
    canonicalScore: number,
    candidateScore: number,
    fieldName: string
  ): { value: string | null; selectedFromLeadId: string; reason: string } {
    if (valCanonical && valCanonical.trim()) {
      return {
        value: valCanonical.trim(),
        selectedFromLeadId: canonicalId,
        reason: `${fieldName} present in canonical lead`,
      };
    }
    if (valCandidate && valCandidate.trim()) {
      return {
        value: valCandidate.trim(),
        selectedFromLeadId: candidateId,
        reason: `${fieldName} missing in canonical lead, populated from candidate lead`,
      };
    }
    return {
      value: null,
      selectedFromLeadId: canonicalId,
      reason: `No ${fieldName.toLowerCase()} found in either lead`,
    };
  }

  /**
   * Generate merge preview DTO showing selected fields and conflicting values.
   */
  public createMergePreview(
    canonicalLead: Record<string, any>,
    candidateLead: Record<string, any>,
    matchReasons: string[] = []
  ): LeadMergePreview {
    const selectedFields = this.selectPrimaryValues(canonicalLead as any, candidateLead as any);

    const conflictingValues: Array<{
      fieldName: string;
      canonicalValue: string | null;
      candidateValue: string | null;
    }> = [];

    const checkConflict = (field: string, valA: string | null, valB: string | null) => {
      if (valA && valB && valA.toLowerCase().trim() !== valB.toLowerCase().trim()) {
        conflictingValues.push({
          fieldName: field,
          canonicalValue: valA,
          candidateValue: valB,
        });
      }
    };

    checkConflict("businessName", canonicalLead.businessName, candidateLead.businessName);
    checkConflict("phone", canonicalLead.phoneNormalized || canonicalLead.phoneRaw, candidateLead.phoneNormalized || candidateLead.phoneRaw);
    checkConflict("email", canonicalLead.email, candidateLead.email);
    checkConflict("website", canonicalLead.website, candidateLead.website);
    checkConflict("address", canonicalLead.addressLine1, candidateLead.addressLine1);

    const totalProvenance = (canonicalLead.provenance?.length || 1) + (candidateLead.provenance?.length || 1);
    const totalVerifications = (canonicalLead.verifications?.length || 0) + (candidateLead.verifications?.length || 0);

    return {
      canonicalLeadId: canonicalLead.id,
      candidateLeadId: candidateLead.id,
      selectedFields,
      conflictingValues,
      matchReasons,
      totalProvenanceRetained: totalProvenance,
      totalVerificationsRetained: totalVerifications,
    };
  }
}

export const leadMergeService = new LeadMergeService();
