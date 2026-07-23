import type { Request, Response } from "express";
import type { ZodType } from "zod";
import { AppError } from "../../common/errors/app-error.js";
import { authenticationRequiredError } from "../auth/auth.errors.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { LeadQualityRepository } from "./lead-quality.repository.js";
import { LeadQualityService } from "./lead-quality.service.js";
import {
  bulkVerifySchema,
  confirmMergeSchema,
  duplicateCandidateParamSchema,
  leadIdParamSchema,
  mergePreviewSchema,
} from "./lead-quality.schemas.js";

const repository = new LeadQualityRepository(prisma as any);
const qualityService = new LeadQualityService(repository);

const parse = <Output>(schema: ZodType<Output>, value: unknown): Output => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", {
      details: { issues: result.error.issues },
    });
  }
  return result.data;
};

const requireUserId = (request: Request): string => {
  if (!request.auth) throw authenticationRequiredError();
  return request.auth.userId;
};

export const getLeadQualitySummary = async (request: Request, response: Response): Promise<void> => {
  const { leadId } = parse(leadIdParamSchema, request.params);
  const summary = await qualityService.getLeadQualitySummary(leadId, requireUserId(request));
  response.status(200).json({ success: true, data: summary });
};

export const getLeadVerifications = async (request: Request, response: Response): Promise<void> => {
  const { leadId } = parse(leadIdParamSchema, request.params);
  const verifications = await qualityService.getLeadVerifications(leadId, requireUserId(request));
  response.status(200).json({ success: true, data: verifications });
};

export const verifySingleLead = async (request: Request, response: Response): Promise<void> => {
  const { leadId } = parse(leadIdParamSchema, request.params);
  const result = await qualityService.verifySingleLead(leadId, requireUserId(request));
  response.status(200).json({ success: true, data: result });
};

export const verifyBulkLeads = async (request: Request, response: Response): Promise<void> => {
  const { leadIds, verificationTypes } = parse(bulkVerifySchema, request.body);
  const result = await qualityService.verifyBulkLeads(leadIds, requireUserId(request), verificationTypes);
  response.status(202).json({ success: true, data: result });
};

export const getDuplicateCandidates = async (request: Request, response: Response): Promise<void> => {
  const { leadId } = parse(leadIdParamSchema, request.params);
  const candidates = await qualityService.getDuplicateCandidates(leadId, requireUserId(request));
  response.status(200).json({ success: true, data: candidates });
};

export const confirmDuplicateCandidate = async (request: Request, response: Response): Promise<void> => {
  const { leadId, candidateId } = parse(duplicateCandidateParamSchema, request.params);
  const result = await qualityService.confirmDuplicateCandidate(leadId, candidateId, requireUserId(request));
  response.status(200).json({ success: true, data: result });
};

export const rejectDuplicateCandidate = async (request: Request, response: Response): Promise<void> => {
  const { leadId, candidateId } = parse(duplicateCandidateParamSchema, request.params);
  const result = await qualityService.rejectDuplicateCandidate(leadId, candidateId, requireUserId(request));
  response.status(200).json({ success: true, data: result });
};

export const previewMerge = async (request: Request, response: Response): Promise<void> => {
  const { canonicalLeadId, candidateLeadId } = parse(mergePreviewSchema, request.body);
  const preview = await qualityService.previewMerge(canonicalLeadId, candidateLeadId, requireUserId(request));
  response.status(200).json({ success: true, data: preview });
};

export const executeMerge = async (request: Request, response: Response): Promise<void> => {
  const { canonicalLeadId, candidateLeadId, reason } = parse(confirmMergeSchema, request.body);
  const result = await qualityService.executeMerge(canonicalLeadId, candidateLeadId, requireUserId(request), reason);
  response.status(200).json({ success: true, data: result });
};

export const getUserQualityDashboardSummary = async (request: Request, response: Response): Promise<void> => {
  const summary = await qualityService.getUserQualityDashboardSummary(requireUserId(request));
  response.status(200).json({ success: true, data: summary });
};

export const getAdminQualityDashboardSummary = async (_request: Request, response: Response): Promise<void> => {
  const summary = await qualityService.getAdminQualityDashboardSummary();
  response.status(200).json({ success: true, data: summary });
};
