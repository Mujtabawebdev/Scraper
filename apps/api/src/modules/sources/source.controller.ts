import type { Request, Response } from "express";

import { getAvailableSources } from "./source.service.js";

export const available = async (
  _request: Request,
  response: Response,
): Promise<void> => {
  response.status(200).json({
    success: true,
    message: "Source availability fetched successfully",
    data: { sources: await getAvailableSources() },
  });
};
