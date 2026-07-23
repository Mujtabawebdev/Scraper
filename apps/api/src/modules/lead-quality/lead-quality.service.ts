import type {
  AdminQualityDashboardSummary,
  LeadDuplicateCandidateSummary,
  LeadMergePreview,
  LeadMergeResult,
  LeadQualitySummary,
  LeadVerificationHistoryItem,
  UserQualityDashboardSummary,
} from "@lead-saas/shared-types";
import { LeadQualityRepository } from "./lead-quality.repository.js";
import {
  CircularMergeNotAllowedError,
  CrossUserMergeNotAllowedError,
  DuplicateCandidateNotFoundError,
  LeadNotFoundError,
  LeadNotOwnedError,
  LeadsNotCompatibleForMergeError,
} from "./lead-quality.errors.js";
import { phoneQualityService } from "./services/phone-quality.service.js";
import { emailQualityService } from "./services/email-quality.service.js";
import { websiteQualityService } from "./services/website-quality.service.js";
import { qualityScoringService } from "./services/quality-scoring.service.js";
import { leadMergeService } from "./services/lead-merge.service.js";

export class LeadQualityService {
  constructor(private readonly repository: LeadQualityRepository) {}

  public async getLeadQualitySummary(leadId: string, userId: string): Promise<LeadQualitySummary> {
    const lead = await this.repository.findLeadById(leadId);
    if (!lead) throw new LeadNotFoundError(leadId);
    if (lead.userId !== userId) throw new LeadNotOwnedError();

    const qualityScoreResult = qualityScoringService.calculateQualityScore({
      businessName: lead.businessName,
      phoneNormalized: lead.phoneNormalized,
      phoneRaw: lead.phoneRaw,
      email: lead.email,
      website: lead.website,
      addressLine1: lead.addressLine1,
      city: lead.city,
      state: lead.state,
      lastVerifiedAt: lead.lastVerifiedAt,
      provenanceCount: lead.provenance.length,
      unresolvedIssueCount: lead.qualityIssues.length,
    });

    const completenessResult = qualityScoringService.calculateCompletenessScore({
      businessName: lead.businessName,
      phoneNormalized: lead.phoneNormalized,
      phoneRaw: lead.phoneRaw,
      email: lead.email,
      website: lead.website,
      category: lead.category,
      addressLine1: lead.addressLine1,
      city: lead.city,
      state: lead.state,
      postalCode: lead.postalCode,
      provenanceCount: lead.provenance.length,
    });

    const freshnessResult = qualityScoringService.determineFreshness(lead.lastVerifiedAt);

    const issues: any[] = lead.qualityIssues.map((i: (typeof lead.qualityIssues)[number]) => ({
      id: i.id,
      leadId: i.leadId,
      issueType: i.issueType as any,
      severity: i.severity as any,
      fieldName: i.fieldName,
      summary: i.summary,
      status: i.status as any,
      createdAt: i.createdAt.toISOString(),
      resolvedAt: i.resolvedAt ? i.resolvedAt.toISOString() : null,
    }));

    return {
      qualityScore: qualityScoreResult.score,
      qualityTier: qualityScoreResult.tier,
      completenessScore: completenessResult.score,
      confidenceScore: lead.confidenceScore,
      confidenceLevel: lead.confidenceLevel as any,
      verificationStatus: lead.verificationStatus as any,
      freshnessStatus: freshnessResult.freshnessStatus,
      reviewStatus: lead.reviewStatus as any,
      lastVerifiedAt: lead.lastVerifiedAt ? lead.lastVerifiedAt.toISOString() : null,
      nextVerificationAt: freshnessResult.nextVerificationAt ? freshnessResult.nextVerificationAt.toISOString() : null,
      staleAt: freshnessResult.staleAt ? freshnessResult.staleAt.toISOString() : null,
      unresolvedIssues: issues,
      scoreExplanations: qualityScoreResult.explanation,
    };
  }

  public async getLeadVerifications(leadId: string, userId: string): Promise<LeadVerificationHistoryItem[]> {
    const lead = await this.repository.findLeadById(leadId);
    if (!lead) throw new LeadNotFoundError(leadId);
    if (lead.userId !== userId) throw new LeadNotOwnedError();

    return this.repository.getLeadVerifications(leadId);
  }

  public async verifySingleLead(leadId: string, userId: string, verificationTypes?: string[]) {
    const lead = await this.repository.findLeadById(leadId);
    if (!lead) throw new LeadNotFoundError(leadId);
    if (lead.userId !== userId) throw new LeadNotOwnedError();

    const phoneResult = phoneQualityService.validatePhoneLocal(lead.phoneNormalized || lead.phoneRaw);
    const emailResult = emailQualityService.validateEmail(lead.email);
    const webResult = websiteQualityService.validateWebsiteLocal(lead.website);

    const verificationStatus = qualityScoringService.determineVerificationStatus(phoneResult, emailResult, webResult);

    await this.repository.saveVerificationResult({
      leadId,
      verificationType: verificationTypes?.join(",") || "PHONE,EMAIL,WEBSITE",
      status: verificationStatus,
      provider: "LOCAL_PlAUSIBILITY_VALIDATOR",
      resultSummary: {
        phone: phoneResult,
        email: emailResult,
        website: webResult,
      },
      createdByUserId: userId,
    });

    return {
      leadId,
      verificationStatus,
      verifiedAt: new Date().toISOString(),
      details: {
        phone: phoneResult,
        email: emailResult,
        website: webResult,
      },
    };
  }

  public async verifyBulkLeads(leadIds: string[], userId: string, verificationTypes?: string[]) {
    const results = [];
    for (const id of leadIds) {
      try {
        const res = await this.verifySingleLead(id, userId, verificationTypes);
        results.push(res);
      } catch (error: any) {
        results.push({ leadId: id, status: "ERROR", error: error.message });
      }
    }
    return {
      totalRequested: leadIds.length,
      processedCount: results.length,
      results,
    };
  }

  public async getDuplicateCandidates(leadId: string, userId: string): Promise<LeadDuplicateCandidateSummary[]> {
    const lead = await this.repository.findLeadById(leadId);
    if (!lead) throw new LeadNotFoundError(leadId);
    if (lead.userId !== userId) throw new LeadNotOwnedError();

    return this.repository.getDuplicateCandidates(leadId);
  }

  public async confirmDuplicateCandidate(leadId: string, candidateId: string, userId: string) {
    const candidates = await this.repository.getDuplicateCandidates(leadId);
    const candidateRecord = candidates.find((c) => c.id === candidateId || c.candidateLeadId === candidateId);
    if (!candidateRecord) throw new DuplicateCandidateNotFoundError(candidateId);

    await this.repository.updateDuplicateCandidateStatus(candidateRecord.id, "CONFIRMED_DUPLICATE", userId);
    return { success: true, message: "Duplicate candidate confirmed" };
  }

  public async rejectDuplicateCandidate(leadId: string, candidateId: string, userId: string) {
    const candidates = await this.repository.getDuplicateCandidates(leadId);
    const candidateRecord = candidates.find((c) => c.id === candidateId || c.candidateLeadId === candidateId);
    if (!candidateRecord) throw new DuplicateCandidateNotFoundError(candidateId);

    await this.repository.updateDuplicateCandidateStatus(candidateRecord.id, "NOT_DUPLICATE", userId);
    return { success: true, message: "Duplicate candidate rejected" };
  }

  public async previewMerge(canonicalLeadId: string, candidateLeadId: string, userId: string): Promise<LeadMergePreview> {
    if (canonicalLeadId === candidateLeadId) {
      throw new CircularMergeNotAllowedError();
    }

    const canonical = await this.repository.findLeadById(canonicalLeadId);
    const candidate = await this.repository.findLeadById(candidateLeadId);

    if (!canonical) throw new LeadNotFoundError(canonicalLeadId);
    if (!candidate) throw new LeadNotFoundError(candidateLeadId);

    if (canonical.userId !== userId || candidate.userId !== userId) {
      throw new CrossUserMergeNotAllowedError();
    }

    return leadMergeService.createMergePreview(canonical, candidate);
  }

  public async executeMerge(
    canonicalLeadId: string,
    candidateLeadId: string,
    userId: string,
    reason?: string
  ): Promise<LeadMergeResult> {
    if (canonicalLeadId === candidateLeadId) {
      throw new CircularMergeNotAllowedError();
    }

    const canonical = await this.repository.findLeadById(canonicalLeadId);
    const candidate = await this.repository.findLeadById(candidateLeadId);

    if (!canonical) throw new LeadNotFoundError(canonicalLeadId);
    if (!candidate) throw new LeadNotFoundError(candidateLeadId);

    if (canonical.userId !== userId || candidate.userId !== userId) {
      throw new CrossUserMergeNotAllowedError();
    }

    const preview = leadMergeService.createMergePreview(canonical, candidate);
    const result = await this.repository.executeLeadMerge({
      canonicalLeadId,
      candidateLeadId,
      actorUserId: userId,
      ...(reason !== undefined ? { reason } : {}),
      selectedFields: preview.selectedFields,
    });

    return {
      success: true,
      canonicalLeadId,
      mergedLeadId: candidateLeadId,
      mergedAt: new Date().toISOString(),
      mergeHistoryId: result.history.id,
      message: "Leads successfully merged. Candidate record preserved and linked to canonical lead.",
    };
  }

  public async getUserQualityDashboardSummary(userId: string): Promise<UserQualityDashboardSummary> {
    return this.repository.getUserQualityDashboardSummary(userId);
  }

  public async getAdminQualityDashboardSummary(): Promise<AdminQualityDashboardSummary> {
    return this.repository.getAdminQualityDashboardSummary();
  }
}
