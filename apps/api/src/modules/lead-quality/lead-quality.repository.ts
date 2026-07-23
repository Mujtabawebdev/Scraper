import { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import type {
  AdminQualityDashboardSummary,
  LeadDuplicateCandidateSummary,
  LeadQualitySummary,
  LeadVerificationHistoryItem,
  QualityIssueItem,
  UserQualityDashboardSummary,
} from "@lead-saas/shared-types";
import { qualityScoringService } from "./services/quality-scoring.service.js";

export class LeadQualityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async findLeadById(leadId: string) {
    return this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        provenance: {
          include: { approvedSource: true },
        },
        verifications: {
          orderBy: { checkedAt: "desc" },
          take: 10,
        },
        qualityIssues: {
          where: { status: "UNRESOLVED" },
        },
        primaryDuplicateCandidates: {
          where: { status: "PENDING" },
          include: { candidateLead: true },
        },
        candidateDuplicateCandidates: {
          where: { status: "PENDING" },
          include: { primaryLead: true },
        },
      },
    });
  }

  public async getLeadVerifications(leadId: string): Promise<LeadVerificationHistoryItem[]> {
    const records = await this.prisma.leadVerification.findMany({
      where: { leadId },
      orderBy: { checkedAt: "desc" },
    });

    return records.map((v: (typeof records)[number]) => ({
      id: v.id,
      leadId: v.leadId,
      verificationType: v.verificationType,
      status: v.status as any,
      provider: v.provider,
      checkedAt: v.checkedAt.toISOString(),
      expiresAt: v.expiresAt ? v.expiresAt.toISOString() : null,
      resultSummary: (v.resultSummary as Record<string, unknown>) || null,
      failureReason: v.failureReason,
    }));
  }

  public async saveVerificationResult(data: {
    leadId: string;
    verificationType: string;
    status: any;
    provider: string;
    resultSummary?: Record<string, unknown>;
    failureReason?: string | null;
    createdByUserId?: string | null;
  }) {
    return this.prisma.leadVerification.create({
      data: {
        leadId: data.leadId,
        verificationType: data.verificationType,
        status: data.status,
        provider: data.provider,
        resultSummary: data.resultSummary ? (data.resultSummary as any) : undefined,
        failureReason: data.failureReason ?? null,
        createdByUserId: data.createdByUserId ?? null,
      },
    });
  }

  public async getDuplicateCandidates(leadId: string): Promise<LeadDuplicateCandidateSummary[]> {
    const candidates = await this.prisma.leadDuplicateCandidate.findMany({
      where: {
        OR: [{ primaryLeadId: leadId }, { candidateLeadId: leadId }],
      },
      include: {
        primaryLead: true,
        candidateLead: true,
      },
      orderBy: { matchScore: "desc" },
    });

    return candidates.map((c: (typeof candidates)[number]) => ({
      id: c.id,
      primaryLeadId: c.primaryLeadId,
      candidateLeadId: c.candidateLeadId,
      matchScore: c.matchScore,
      matchLevel: c.matchLevel as any,
      matchReasons: (c.matchReasons as string[]) || [],
      status: c.status as any,
      primaryLead: {
        id: c.primaryLead.id,
        businessName: c.primaryLead.businessName,
        phone: c.primaryLead.phoneNormalized || c.primaryLead.phoneRaw,
        email: c.primaryLead.email,
        website: c.primaryLead.website,
        city: c.primaryLead.city,
        state: c.primaryLead.state,
        confidenceScore: c.primaryLead.confidenceScore,
      },
      candidateLead: {
        id: c.candidateLead.id,
        businessName: c.candidateLead.businessName,
        phone: c.candidateLead.phoneNormalized || c.candidateLead.phoneRaw,
        email: c.candidateLead.email,
        website: c.candidateLead.website,
        city: c.candidateLead.city,
        state: c.candidateLead.state,
        confidenceScore: c.candidateLead.confidenceScore,
      },
      createdAt: c.createdAt.toISOString(),
      reviewedAt: c.reviewedAt ? c.reviewedAt.toISOString() : null,
      reviewNotes: c.reviewNotes,
    }));
  }

  public async upsertDuplicateCandidate(data: {
    primaryLeadId: string;
    candidateLeadId: string;
    matchScore: number;
    matchLevel: any;
    matchReasons: string[];
  }) {
    return this.prisma.leadDuplicateCandidate.upsert({
      where: {
        primaryLeadId_candidateLeadId: {
          primaryLeadId: data.primaryLeadId,
          candidateLeadId: data.candidateLeadId,
        },
      },
      create: {
        primaryLeadId: data.primaryLeadId,
        candidateLeadId: data.candidateLeadId,
        matchScore: data.matchScore,
        matchLevel: data.matchLevel,
        matchReasons: data.matchReasons,
        status: "PENDING",
      },
      update: {
        matchScore: data.matchScore,
        matchLevel: data.matchLevel,
        matchReasons: data.matchReasons,
      },
    });
  }

  public async updateDuplicateCandidateStatus(
    candidateId: string,
    status: any,
    userId?: string,
    notes?: string
  ) {
    return this.prisma.leadDuplicateCandidate.update({
      where: { id: candidateId },
      data: {
        status,
        reviewedByUserId: userId ?? null,
        reviewedAt: new Date(),
        reviewNotes: notes ?? null,
      },
    });
  }

  public async executeLeadMerge(params: {
    canonicalLeadId: string;
    candidateLeadId: string;
    actorUserId: string;
    reason?: string;
    selectedFields: Record<string, any>;
  }) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const canonical = await tx.lead.findUniqueOrThrow({
        where: { id: params.canonicalLeadId },
        include: { provenance: true, verifications: true },
      });
      const candidate = await tx.lead.findUniqueOrThrow({
        where: { id: params.candidateLeadId },
        include: { provenance: true, verifications: true },
      });

      // Preserve snapshot of candidate
      const snapshot = {
        lead: candidate,
        provenance: candidate.provenance,
        verifications: candidate.verifications,
      };

      // Reassign candidate provenance to canonical lead
      await tx.leadProvenance.updateMany({
        where: { leadId: params.candidateLeadId },
        data: { leadId: params.canonicalLeadId },
      });

      // Reassign candidate verifications to canonical lead
      await tx.leadVerification.updateMany({
        where: { leadId: params.candidateLeadId },
        data: { leadId: params.canonicalLeadId },
      });

      // Record merge history
      const history = await tx.leadMergeHistory.create({
        data: {
          canonicalLeadId: params.canonicalLeadId,
          mergedLeadId: params.candidateLeadId,
          actorUserId: params.actorUserId,
          reason: params.reason || "Confirmed duplicate merge",
          preservedSnapshot: snapshot as any,
        },
      });

      // Update candidate lead as merged
      await tx.lead.update({
        where: { id: params.candidateLeadId },
        data: {
          canonicalLeadId: params.canonicalLeadId,
          mergedAt: new Date(),
          mergedByUserId: params.actorUserId,
          mergeReason: params.reason || "Merged into canonical lead",
          status: "DUPLICATE",
        },
      });

      // Update canonical lead primary fields
      const updatedCanonical = await tx.lead.update({
        where: { id: params.canonicalLeadId },
        data: {
          businessName: params.selectedFields.businessName?.value || canonical.businessName,
          phoneNormalized: params.selectedFields.phone?.value ?? canonical.phoneNormalized,
          email: params.selectedFields.email?.value ?? canonical.email,
          website: params.selectedFields.website?.value ?? canonical.website,
          addressLine1: params.selectedFields.address?.value ?? canonical.addressLine1,
          city: params.selectedFields.city?.value ?? canonical.city,
          state: params.selectedFields.state?.value ?? canonical.state,
          postalCode: params.selectedFields.postalCode?.value ?? canonical.postalCode,
          updatedAt: new Date(),
        },
      });

      // Mark candidate duplicate candidates as CONFIRMED_DUPLICATE
      await tx.leadDuplicateCandidate.updateMany({
        where: {
          OR: [
            { primaryLeadId: params.canonicalLeadId, candidateLeadId: params.candidateLeadId },
            { primaryLeadId: params.candidateLeadId, candidateLeadId: params.canonicalLeadId },
          ],
        },
        data: {
          status: "CONFIRMED_DUPLICATE",
          reviewedByUserId: params.actorUserId,
          reviewedAt: new Date(),
        },
      });

      return { updatedCanonical, history };
    });
  }

  public async getUserQualityDashboardSummary(userId: string): Promise<UserQualityDashboardSummary> {
    const totalLeads = await this.prisma.lead.count({ where: { userId, status: { not: "DUPLICATE" } } });
    const excellentLeads = await this.prisma.lead.count({
      where: { userId, status: { not: "DUPLICATE" }, qualityScore: { gte: 90 } },
    });
    const goodLeads = await this.prisma.lead.count({
      where: { userId, status: { not: "DUPLICATE" }, qualityScore: { gte: 75, lt: 90 } },
    });
    const validPhoneLeads = await this.prisma.lead.count({
      where: { userId, status: { not: "DUPLICATE" }, phoneNormalized: { not: null } },
    });
    const verifiedContactLeads = await this.prisma.lead.count({
      where: { userId, status: { not: "DUPLICATE" }, verificationStatus: "VERIFIED" },
    });
    const staleLeads = await this.prisma.lead.count({
      where: { userId, status: { not: "DUPLICATE" }, freshnessStatus: "STALE" },
    });
    const reviewRequiredLeads = await this.prisma.lead.count({
      where: { userId, status: { not: "DUPLICATE" }, reviewStatus: "REVIEW_REQUIRED" },
    });
    const duplicateCandidatesCount = await this.prisma.leadDuplicateCandidate.count({
      where: {
        status: "PENDING",
        primaryLead: { userId },
      },
    });

    const avgQuality = await this.prisma.lead.aggregate({
      where: { userId, status: { not: "DUPLICATE" } },
      _avg: { qualityScore: true, completenessScore: true },
    });

    const recentStale = await this.prisma.lead.findMany({
      where: { userId, status: { not: "DUPLICATE" }, freshnessStatus: "STALE" },
      orderBy: { staleAt: "desc" },
      take: 5,
      select: { id: true, businessName: true, phoneNormalized: true, qualityScore: true, staleAt: true },
    });

    const highSeverityIssues = await this.prisma.leadQualityIssue.findMany({
      where: { lead: { userId }, status: "UNRESOLVED", severity: { in: ["HIGH", "CRITICAL"] } },
      take: 5,
      orderBy: { createdAt: "desc" },
    });

    const pendingDuplicates = await this.getDuplicateCandidatesForUser(userId, 5);

    return {
      totalLeads,
      excellentQualityLeads: excellentLeads,
      goodQualityLeads: goodLeads,
      validPhoneLeads,
      verifiedContactLeads,
      staleLeads,
      reviewRequiredLeads,
      duplicateCandidatesCount,
      conflictingValueLeads: 0,
      avgQualityScore: Math.round(avgQuality._avg.qualityScore || 0),
      avgCompletenessScore: Math.round(avgQuality._avg.completenessScore || 0),
      recentStaleLeads: recentStale.map((l: (typeof recentStale)[number]) => ({
        id: l.id,
        businessName: l.businessName,
        phone: l.phoneNormalized,
        qualityScore: l.qualityScore,
        staleAt: l.staleAt ? l.staleAt.toISOString() : null,
      })),
      highestSeverityIssues: highSeverityIssues.map((i: (typeof highSeverityIssues)[number]) => ({
        id: i.id,
        leadId: i.leadId,
        issueType: i.issueType as any,
        severity: i.severity as any,
        fieldName: i.fieldName,
        summary: i.summary,
        status: i.status as any,
        createdAt: i.createdAt.toISOString(),
        resolvedAt: i.resolvedAt ? i.resolvedAt.toISOString() : null,
      })),
      pendingDuplicateReviews: pendingDuplicates,
    };
  }

  private async getDuplicateCandidatesForUser(userId: string, limit: number): Promise<LeadDuplicateCandidateSummary[]> {
    const candidates = await this.prisma.leadDuplicateCandidate.findMany({
      where: {
        status: "PENDING",
        primaryLead: { userId },
      },
      include: { primaryLead: true, candidateLead: true },
      take: limit,
      orderBy: { matchScore: "desc" },
    });

    return candidates.map((c: (typeof candidates)[number]) => ({
      id: c.id,
      primaryLeadId: c.primaryLeadId,
      candidateLeadId: c.candidateLeadId,
      matchScore: c.matchScore,
      matchLevel: c.matchLevel as any,
      matchReasons: (c.matchReasons as string[]) || [],
      status: c.status as any,
      primaryLead: {
        id: c.primaryLead.id,
        businessName: c.primaryLead.businessName,
        phone: c.primaryLead.phoneNormalized || c.primaryLead.phoneRaw,
        email: c.primaryLead.email,
        website: c.primaryLead.website,
        city: c.primaryLead.city,
        state: c.primaryLead.state,
        confidenceScore: c.primaryLead.confidenceScore,
      },
      candidateLead: {
        id: c.candidateLead.id,
        businessName: c.candidateLead.businessName,
        phone: c.candidateLead.phoneNormalized || c.candidateLead.phoneRaw,
        email: c.candidateLead.email,
        website: c.candidateLead.website,
        city: c.candidateLead.city,
        state: c.candidateLead.state,
        confidenceScore: c.candidateLead.confidenceScore,
      },
      createdAt: c.createdAt.toISOString(),
      reviewedAt: c.reviewedAt ? c.reviewedAt.toISOString() : null,
      reviewNotes: c.reviewNotes,
    }));
  }

  public async getAdminQualityDashboardSummary(): Promise<AdminQualityDashboardSummary> {
    const totalActiveLeads = await this.prisma.lead.count({ where: { status: { not: "DUPLICATE" } } });
    const canonicalLeads = await this.prisma.lead.count({ where: { canonicalLeadId: null } });
    const mergedRecords = await this.prisma.lead.count({ where: { status: "DUPLICATE" } });
    const duplicateCandidates = await this.prisma.leadDuplicateCandidate.count({ where: { status: "PENDING" } });
    const staleLeads = await this.prisma.lead.count({ where: { freshnessStatus: "STALE" } });
    const verificationFailures = await this.prisma.leadVerification.count({ where: { status: "VERIFICATION_FAILED" } });
    const highSeverityIssues = await this.prisma.leadQualityIssue.count({
      where: { status: "UNRESOLVED", severity: { in: ["HIGH", "CRITICAL"] } },
    });

    const avgQuality = await this.prisma.lead.aggregate({
      _avg: { qualityScore: true, completenessScore: true },
    });

    const blockedSources = await this.prisma.approvedSource.findMany({
      where: { status: "BLOCKED" },
      select: { key: true, displayName: true, blockedReason: true },
    });

    return {
      totalActiveLeads,
      canonicalLeads,
      mergedRecords,
      duplicateCandidates,
      staleLeads,
      verificationFailures,
      highSeverityIssues,
      avgQualityScore: Math.round(avgQuality._avg.qualityScore || 0),
      avgCompletenessScore: Math.round(avgQuality._avg.completenessScore || 0),
      blockedSourceImpact: blockedSources.map((s: (typeof blockedSources)[number]) => ({
        sourceKey: s.key,
        displayName: s.displayName,
        blockedReason: s.blockedReason,
        affectedLeadCount: 0,
      })),
    };
  }
}
