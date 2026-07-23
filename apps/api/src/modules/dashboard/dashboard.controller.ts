import type { Request, Response } from "express";

import { authenticationRequiredError } from "../auth/auth.errors.js";
import { getDashboardSummary } from "./dashboard.service.js";

export const summary = async (
  request: Request,
  response: Response,
): Promise<void> => {
  if (!request.auth) throw authenticationRequiredError();
  const result = await getDashboardSummary(request.auth.userId);
  response.status(200).json({
    success: true,
    message: "Dashboard summary fetched successfully",
    data: { summary: result },
  });
};
