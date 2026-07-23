import { Router } from "express";

import { getLead, listLeads } from "./lead.service.js";
import { leadIdSchema, listLeadsQuerySchema } from "./lead.schemas.js";

export const leadRouter = Router();

leadRouter.get("/", async (request, response) => {
  const parsed = listLeadsQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({
      success: false,
      message: "Lead query validation failed",
      error: { code: "VALIDATION_ERROR", issues: parsed.error.issues },
    });
    return;
  }
  response.status(200).json({ success: true, ...(await listLeads(parsed.data)) });
});

leadRouter.get("/:id", async (request, response) => {
  const parsedId = leadIdSchema.safeParse(request.params.id);
  if (!parsedId.success) {
    response.status(400).json({
      success: false,
      message: "Lead ID must be a valid UUID",
      error: { code: "INVALID_LEAD_ID" },
    });
    return;
  }
  const lead = await getLead(parsedId.data);
  if (!lead) {
    response.status(404).json({
      success: false,
      message: "Lead was not found",
      error: { code: "LEAD_NOT_FOUND" },
    });
    return;
  }
  response.status(200).json({ success: true, data: lead });
});
