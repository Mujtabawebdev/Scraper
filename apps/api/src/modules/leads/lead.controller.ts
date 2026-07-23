import type { Request, Response } from "express";
import type { ZodType } from "zod";

import { AppError } from "../../common/errors/app-error.js";
import { authenticationRequiredError } from "../auth/auth.errors.js";
import { exportLeadsCsv } from "./lead-export.service.js";
import {
  exportLeadsQuerySchema,
  leadParamsSchema,
  listLeadsQuerySchema,
} from "./lead.schemas.js";
import { getLead, listLeads } from "./lead.service.js";

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

export const list = async (request: Request, response: Response): Promise<void> => {
  const query = parse(listLeadsQuerySchema, request.query);
  const result = await listLeads(requireUserId(request), query);
  response.status(200).json({
    success: true,
    message: "Leads fetched successfully",
    data: result,
  });
};

export const detail = async (request: Request, response: Response): Promise<void> => {
  const params = parse(leadParamsSchema, request.params);
  const lead = await getLead(requireUserId(request), params.leadId);
  response.status(200).json({
    success: true,
    message: "Lead fetched successfully",
    data: { lead },
  });
};

export const exportCsv = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = parse(exportLeadsQuerySchema, request.query);
  const csv = await exportLeadsCsv(requireUserId(request), query);
  const date = new Date().toISOString().slice(0, 10);
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="leads-export-${date}.csv"`,
  );
  response.status(200).send(csv);
};
